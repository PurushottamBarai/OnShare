import { describe, it, expect, vi } from 'vitest';
import { PeerManager } from '../src/webrtc/PeerManager.js';

describe('WebRTC Teardown & Completion Lifecycle', () => {
  it('suppresses onStateChange events during and after close() in PeerManager', () => {
    const onStateChange = vi.fn();
    const pm = new PeerManager({
      peerId: 'peer-1',
      role: 'receiver',
      onStateChange,
    });

    pm.state = 'ACCEPTED';
    expect(pm.isClosing).toBeFalsy();

    // Call close
    pm.close();

    expect(pm.isClosing).toBe(true);
    expect(pm.state).toBe('CLOSED');
    // onStateChange must NOT be called on intentional teardown
    expect(onStateChange).not.toHaveBeenCalled();

    // Any late setState calls must be suppressed
    pm.setState('FAILED');
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('preserves receiver DONE state and ignores post-transfer teardown events', () => {
    let receiverState = 'DONE';
    let errorMessage = null;

    const onStateChange = (state) => {
      const current = receiverState;
      if (current === 'DONE' || current === 'DECLINED' || current === 'TEXT_ACTIVE') {
        return;
      }
      if (state === 'DECLINED') receiverState = 'DECLINED';
      if (state === 'FAILED') {
        receiverState = 'FAILED';
        errorMessage = 'Connection was interrupted or closed by the sender. Please try again.';
      }
    };

    // Simulate post-transfer teardown where WebRTC closes or fails
    onStateChange('CLOSED');
    expect(receiverState).toBe('DONE');
    expect(errorMessage).toBeNull();

    onStateChange('FAILED');
    expect(receiverState).toBe('DONE');
    expect(errorMessage).toBeNull();
  });

  it('preserves sender receiver status as done when connection closes after transfer', () => {
    let receivers = [
      { id: 'recv-1', label: 'Receiver (53e0)', status: 'done', progress: 100 }
    ];

    // Simulate onStateChange FAILED after transfer finished
    const handleStateChange = (receiverId, state) => {
      receivers = receivers.map(r => {
        if (r.id !== receiverId) return r;
        if (r.status === 'done' && state !== 'DONE') return r;
        if (state === 'FAILED') return { ...r, status: 'failed' };
        return r;
      });
    };

    handleStateChange('recv-1', 'FAILED');
    expect(receivers[0].status).toBe('done');
    expect(receivers[0].progress).toBe(100);

    // Simulate peer.left after receiver disconnects
    const handlePeerLeft = (peerId) => {
      receivers = receivers.map(r => {
        if (r.id !== peerId) return r;
        if (r.status === 'done') return r;
        return { ...r, status: 'declined' };
      });
    };

    handlePeerLeft('recv-1');
    expect(receivers[0].status).toBe('done');
    expect(receivers[0].progress).toBe(100);
  });

  it('preserves PeerManager DONE state and ignores subsequent FAILED or CLOSED transitions', () => {
    const onStateChange = vi.fn();
    const pm = new PeerManager({
      peerId: 'peer-2',
      role: 'receiver',
      onStateChange,
    });

    pm.setState('DONE');
    expect(pm.state).toBe('DONE');
    expect(onStateChange).toHaveBeenCalledWith('DONE', null);

    // Any subsequent state change to FAILED or CLOSED should be ignored
    pm.setState('FAILED', 'late error');
    expect(pm.state).toBe('DONE');
    expect(onStateChange).toHaveBeenCalledTimes(1);

    pm.setState('CLOSED');
    expect(pm.state).toBe('DONE');
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });
});
