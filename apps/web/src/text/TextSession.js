import * as Y from 'yjs';

// Protocol tags for binary Yjs messages over WebRTC text channel
const MSG_SYNC_STEP_1 = 1;
const MSG_SYNC_STEP_2 = 2;
const MSG_UPDATE = 3;

export const MAX_TEXT_CHARACTERS = 500000; // 500,000 chars per PRD TX-5

/**
 * TextSession (TRD Section 8 & PRD Section 7.5)
 * Manages Yjs collaborative plain-text editing over WebRTC DataChannel in a star topology.
 */
export class TextSession {
  constructor({ role, onTextChange, onPermissionChange }) {
    this.role = role; // 'sender' (hub) | 'receiver'
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('shared-text');
    this.canEdit = role === 'sender'; // Sender can always edit; receivers edit when allowed
    this.onTextChange = onTextChange;
    this.onPermissionChange = onPermissionChange;

    // peerId -> { textChannel, controlChannel }
    this.peers = new Map();

    // Listen to local / applied Yjs document text changes
    this.ytext.observe(() => {
      if (this.onTextChange) {
        this.onTextChange(this.ytext.toString());
      }
    });

    // Listen to document updates to broadcast to peers
    this.ydoc.on('update', (update, origin) => {
      // origin identifies who initiated the update
      if (this.role === 'sender') {
        // Sender broadcasts update to all connected receivers except the origin
        this.broadcastUpdate(update, origin);
      } else if (origin === 'local') {
        // Receiver sends update to sender hub if editing is allowed
        if (this.canEdit) {
          this.sendToSender(MSG_UPDATE, update);
        }
      }
    });
  }

  getText() {
    return this.ytext.toString();
  }

  insertText(index, text) {
    if (!this.canEdit) return;
    const currentLength = this.ytext.length;
    const allowed = Math.max(0, MAX_TEXT_CHARACTERS - currentLength);
    const toInsert = text.slice(0, allowed);
    if (toInsert.length > 0) {
      this.ydoc.transact(() => {
        this.ytext.insert(index, toInsert);
      }, 'local');
    }
  }

  deleteText(index, length) {
    if (!this.canEdit) return;
    this.ydoc.transact(() => {
      this.ytext.delete(index, length);
    }, 'local');
  }

  replaceText(newText) {
    if (!this.canEdit) return;
    const toInsert = (newText || '').slice(0, MAX_TEXT_CHARACTERS);
    this.ydoc.transact(() => {
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, toInsert);
    }, 'local');
  }

  /**
   * Sender toggles receiver editing permission (PRD TX-2)
   */
  setReceiverCanEdit(allowed) {
    if (this.role !== 'sender') return;
    this.canEdit = true;
    const canEdit = Boolean(allowed);

    // Notify all connected receivers via control channel
    for (const peer of this.peers.values()) {
      if (peer.controlChannel?.readyState === 'open') {
        try {
          peer.controlChannel.send(JSON.stringify({
            type: 'text.canEdit',
            canEdit,
          }));
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Register a connected peer's data channels
   */
  addPeer(peerId, textChannel, controlChannel) {
    this.peers.set(peerId, { textChannel, controlChannel });

    textChannel.binaryType = 'arraybuffer';
    textChannel.onmessage = (event) => {
      this.handleIncomingBinary(peerId, new Uint8Array(event.data));
    };

    if (this.role === 'sender') {
      // Sender is hub: send current document state to newly joined receiver
      const fullState = Y.encodeStateAsUpdate(this.ydoc);
      if (fullState.byteLength > 0) {
        this.sendToPeer(peerId, MSG_SYNC_STEP_2, fullState);
      }

      // Send initial edit permissions
      if (controlChannel?.readyState === 'open') {
        try {
          controlChannel.send(JSON.stringify({
            type: 'text.canEdit',
            canEdit: this.canEdit,
          }));
        } catch {
          // ignore
        }
      }
    } else {
      // Receiver connects: send state vector to hub to request missing diffs
      const sv = Y.encodeStateVector(this.ydoc);
      this.sendToPeer(peerId, MSG_SYNC_STEP_1, sv);
    }
  }

  removePeer(peerId) {
    this.peers.delete(peerId);
  }

  handleIncomingBinary(peerId, uint8) {
    if (!uint8 || uint8.byteLength < 1) return;

    const msgType = uint8[0];
    const payload = uint8.subarray(1);

    switch (msgType) {
      case MSG_SYNC_STEP_1: {
        // Received remote state vector; respond with diff
        const diff = Y.encodeStateAsUpdate(this.ydoc, payload);
        this.sendToPeer(peerId, MSG_SYNC_STEP_2, diff);
        break;
      }

      case MSG_SYNC_STEP_2: {
        // Received state diff; apply update
        Y.applyUpdate(this.ydoc, payload, peerId);
        break;
      }

      case MSG_UPDATE: {
        // Incremental document edit update
        if (this.role === 'sender') {
          // Sender checks if receiver editing is permitted
          if (!this.canEdit) {
            // Edit toggle enforcement: ignore update
            return;
          }
          // Apply update with receiver origin
          Y.applyUpdate(this.ydoc, payload, peerId);
        } else {
          // Receiver applies hub update
          Y.applyUpdate(this.ydoc, payload, 'hub');
        }
        break;
      }
    }
  }

  sendToPeer(peerId, msgType, payload) {
    const peer = this.peers.get(peerId);
    if (peer?.textChannel?.readyState === 'open') {
      const msg = new Uint8Array(1 + payload.byteLength);
      msg[0] = msgType;
      msg.set(payload, 1);
      try {
        peer.textChannel.send(msg);
      } catch {
        // ignore
      }
    }
  }

  broadcastUpdate(update, origin) {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== origin && peer.textChannel?.readyState === 'open') {
        const msg = new Uint8Array(1 + update.byteLength);
        msg[0] = MSG_UPDATE;
        msg.set(update, 1);
        try {
          peer.textChannel.send(msg);
        } catch {
          // ignore
        }
      }
    }
  }

  sendToSender(msgType, payload) {
    for (const peer of this.peers.values()) {
      if (peer.textChannel?.readyState === 'open') {
        const msg = new Uint8Array(1 + payload.byteLength);
        msg[0] = msgType;
        msg.set(payload, 1);
        try {
          peer.textChannel.send(msg);
        } catch {
          // ignore
        }
        break;
      }
    }
  }

  handleControlMessage(data) {
    if (data.type === 'text.canEdit') {
      this.canEdit = Boolean(data.canEdit);
      if (this.onPermissionChange) {
        this.onPermissionChange(this.canEdit);
      }
    }
  }

  destroy() {
    this.ydoc.destroy();
    this.peers.clear();
  }
}
