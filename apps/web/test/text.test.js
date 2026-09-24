import { describe, it, expect } from 'vitest';
import { TextSession } from '../src/text/TextSession.js';

// Mock WebRTC DataChannel
class MockDataChannel {
  constructor(name) {
    this.name = name;
    this.readyState = 'open';
    this.binaryType = 'arraybuffer';
    this.peer = null;
    this.onmessage = null;
  }

  send(data) {
    if (this.peer && this.peer.onmessage) {
      setTimeout(() => {
        this.peer.onmessage({ data });
      }, 0);
    }
  }
}

function createChannelPair(name) {
  const c1 = new MockDataChannel(name);
  const c2 = new MockDataChannel(name);
  c1.peer = c2;
  c2.peer = c1;
  return [c1, c2];
}

describe('Live Text Sharing via Yjs (TRD Section 8 & PRD Section 7.5)', () => {
  it('synchronizes text from sender to receiver in real-time', async () => {
    let receiverText = '';
    const sender = new TextSession({ role: 'sender' });
    const receiver = new TextSession({
      role: 'receiver',
      onTextChange: (t) => { receiverText = t; },
    });

    const [senderTextCh, receiverTextCh] = createChannelPair('text');
    const [senderCtrlCh, receiverCtrlCh] = createChannelPair('control');

    sender.addPeer('recv-1', senderTextCh, senderCtrlCh);
    receiver.addPeer('sender', receiverTextCh, receiverCtrlCh);

    // Sender inserts text
    sender.replaceText('Hello from sender!');

    // Wait for async message delivery
    await new Promise(r => setTimeout(r, 20));

    expect(receiverText).toBe('Hello from sender!');
    expect(receiver.getText()).toBe('Hello from sender!');
  });

  it('allows receiver edits when permitted, and merges concurrently', async () => {
    let senderText = '';
    const sender = new TextSession({
      role: 'sender',
      onTextChange: (t) => { senderText = t; },
    });
    const receiver = new TextSession({ role: 'receiver' });

    const [senderTextCh, receiverTextCh] = createChannelPair('text');
    const [senderCtrlCh, receiverCtrlCh] = createChannelPair('control');

    sender.addPeer('recv-1', senderTextCh, senderCtrlCh);
    receiver.addPeer('sender', receiverTextCh, receiverCtrlCh);

    // Initial state
    sender.replaceText('Start');
    await new Promise(r => setTimeout(r, 20));

    // Receiver allowed to edit
    receiver.canEdit = true;
    receiver.insertText(5, ' and Finish');
    await new Promise(r => setTimeout(r, 20));

    expect(sender.getText()).toBe('Start and Finish');
    expect(senderText).toBe('Start and Finish');
  });

  it('enforces sender edit toggle at hub: rejects receiver updates when editing disabled', async () => {
    const sender = new TextSession({ role: 'sender' });
    const receiver = new TextSession({ role: 'receiver' });

    const [senderTextCh, receiverTextCh] = createChannelPair('text');
    const [senderCtrlCh, receiverCtrlCh] = createChannelPair('control');

    sender.addPeer('recv-1', senderTextCh, senderCtrlCh);
    receiver.addPeer('sender', receiverTextCh, receiverCtrlCh);

    sender.replaceText('Initial content');
    await new Promise(r => setTimeout(r, 20));

    // Sender turns editing off
    sender.setReceiverCanEdit(false);
    sender.canEdit = false; // sender's hub enforcement

    // Malicious or desynced receiver tries to insert text
    receiver.canEdit = true;
    receiver.insertText(0, 'Hacked: ');
    await new Promise(r => setTimeout(r, 20));

    // Hub rejected update
    expect(sender.getText()).toBe('Initial content');
  });

  it('provides full text state to later joiner (PRD TX-6)', async () => {
    const sender = new TextSession({ role: 'sender' });
    sender.replaceText('Document created before receiver connected');

    let laterReceiverText = '';
    const laterReceiver = new TextSession({
      role: 'receiver',
      onTextChange: (t) => { laterReceiverText = t; },
    });

    const [senderTextCh, receiverTextCh] = createChannelPair('text');
    const [senderCtrlCh, receiverCtrlCh] = createChannelPair('control');

    sender.addPeer('late-recv', senderTextCh, senderCtrlCh);
    laterReceiver.addPeer('sender', receiverTextCh, receiverCtrlCh);

    // Wait for sync exchange
    await new Promise(r => setTimeout(r, 50));

    expect(laterReceiver.getText()).toBe('Document created before receiver connected');
    expect(laterReceiverText).toBe('Document created before receiver connected');
  });
});
