import * as Y from 'yjs';

const MSG_SYNC_STEP_1 = 1;
const MSG_SYNC_STEP_2 = 2;
const MSG_UPDATE = 3;

export const MAX_TEXT_CHARACTERS = 500000;

export class TextSession {
  constructor({ role, onTextChange, onPermissionChange }) {
    this.role = role;
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('shared-text');
    this.canEdit = role === 'sender';
    this.onTextChange = onTextChange;
    this.onPermissionChange = onPermissionChange;

    this.peers = new Map();

    this.ytext.observe(() => {
      if (this.onTextChange) {
        this.onTextChange(this.ytext.toString());
      }
    });

    this.ydoc.on('update', (update, origin) => {
      if (this.role === 'sender') {
        this.broadcastUpdate(update, origin);
      } else if (origin === 'local') {
        if (this.canEdit) {
          this.sendToSender(MSG_UPDATE, update);
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.__activeTextSessions = window.__activeTextSessions || new Set();
      window.__activeTextSessions.add(this);
    }
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

  setReceiverCanEdit(allowed) {
    if (this.role !== 'sender') return;
    this.canEdit = true;
    const canEdit = Boolean(allowed);

    for (const peer of this.peers.values()) {
      if (peer.controlChannel?.readyState === 'open') {
        try {
          peer.controlChannel.send(JSON.stringify({
            type: 'text.canEdit',
            canEdit,
          }));
        } catch {
          void 0;
        }
      }
    }
  }

  addPeer(peerId, textChannel, controlChannel) {
    this.peers.set(peerId, { textChannel, controlChannel });

    textChannel.binaryType = 'arraybuffer';
    textChannel.onmessage = (event) => {
      this.handleIncomingBinary(peerId, new Uint8Array(event.data));
    };

    if (controlChannel) {
      const onMsg = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleControlMessage(data);
        } catch {
          void 0;
        }
      };
      if (typeof controlChannel.addEventListener === 'function') {
        controlChannel.addEventListener('message', onMsg);
      } else {
        controlChannel.onmessage = onMsg;
      }
    }

    if (this.role === 'sender') {
      const sendInitialState = () => {
        const fullState = Y.encodeStateAsUpdate(this.ydoc);
        if (fullState.byteLength > 0) {
          this.sendToPeer(peerId, MSG_SYNC_STEP_2, fullState);
        }

        if (controlChannel?.readyState === 'open') {
          try {
            controlChannel.send(JSON.stringify({
              type: 'text.canEdit',
              canEdit: this.canEdit,
            }));
          } catch {
            void 0;
          }
        }
      };

      if (textChannel.readyState === 'open') {
        sendInitialState();
      } else {
        textChannel.addEventListener('open', sendInitialState);
      }
    } else {
      const sendInitialState = () => {
        const sv = Y.encodeStateVector(this.ydoc);
        this.sendToPeer(peerId, MSG_SYNC_STEP_1, sv);
      };
      
      if (textChannel.readyState === 'open') {
        sendInitialState();
      } else {
        textChannel.addEventListener('open', sendInitialState);
      }
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
        const diff = Y.encodeStateAsUpdate(this.ydoc, payload);
        this.sendToPeer(peerId, MSG_SYNC_STEP_2, diff);
        
        if (this.role === 'sender') {
          const peer = this.peers.get(peerId);
          if (peer?.controlChannel?.readyState === 'open') {
            try {
              peer.controlChannel.send(JSON.stringify({
                type: 'text.canEdit',
                canEdit: this.canEdit,
              }));
            } catch {
              void 0;
            }
          }
        }
        break;
      }

      case MSG_SYNC_STEP_2: {
        Y.applyUpdate(this.ydoc, payload, peerId);
        break;
      }

      case MSG_UPDATE: {
        if (this.role === 'sender') {
          if (!this.canEdit) {
            return;
          }
          Y.applyUpdate(this.ydoc, payload, peerId);
        } else {
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
        void 0;
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
          void 0;
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
          void 0;
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
    if (typeof window !== 'undefined' && window.__activeTextSessions) {
      window.__activeTextSessions.delete(this);
    }
    this.ydoc.destroy();
    this.peers.clear();
  }
}
