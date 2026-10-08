import { decodeFrame } from './frame.js';
import { sanitizeFilename } from './senderPipeline.js';

/**
 * Receiver Sink (TRD Section 7.4)
 * Receives binary frames from WebRTC dataChannel and streams to disk
 * via File System Access API or Blob download fallback.
 */
export class ReceiverSink {
  constructor({
    manifest,
    controlChannel,
    dataChannel,
    onProgress,
    onComplete,
    onError,
  }) {
    this.manifest = manifest || {};
    this.controlChannel = controlChannel;
    this.dataChannel = dataChannel;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    this.totalBytesReceived = 0;
    this.totalBytesExpected = manifest.totalSize || 0;
    this.isZip = Boolean(manifest.zip || (manifest.files && manifest.files.length > 1));
    this.suggestedFilename = this.determineFilename();

    this.fileHandle = null;
    this.writableStream = null;
    this.writeQueue = Promise.resolve();
    this.pendingWriteBatch = [];
    this.pendingWriteBytes = 0;
    this.MAX_WRITE_BATCH_BYTES = 512 * 1024; // 512 KiB write batch to minimize disk syscalls
    this.chunks = []; // Blob fallback chunks
    this.isCompleted = false;
    this.isCancelled = false;
    this.startTime = null;
    this.lastAckBytes = 0;

    this.bindDataChannel();
  }

  flushWriteBatch() {
    if (!this.writableStream || this.pendingWriteBatch.length === 0) return;

    let bufferToWrite;
    if (this.pendingWriteBatch.length === 1) {
      bufferToWrite = this.pendingWriteBatch[0];
    } else {
      const merged = new Uint8Array(this.pendingWriteBytes);
      let offset = 0;
      for (let i = 0; i < this.pendingWriteBatch.length; i++) {
        merged.set(this.pendingWriteBatch[i], offset);
        offset += this.pendingWriteBatch[i].byteLength;
      }
      bufferToWrite = merged;
    }

    this.pendingWriteBatch = [];
    this.pendingWriteBytes = 0;

    this.writeQueue = this.writeQueue.then(async () => {
      if (this.isCancelled || !this.writableStream) return;
      await this.writableStream.write(bufferToWrite);
    }).catch((err) => {
      if (!this.isCancelled && this.onError) this.onError(err);
    });
  }

  determineFilename() {
    if (this.isZip) {
      return this.manifest.zipFilename || 'OnShare-Archive.zip';
    }
    if (this.manifest.files && this.manifest.files.length === 1) {
      return sanitizeFilename(this.manifest.files[0].name);
    }
    return 'OnShare-Download';
  }

  /**
   * Request disk stream via File System Access API if supported (Chromium)
   * Must be called during or immediately after user gesture (Accept click)
   */
  async initFileSystemTarget() {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: this.suggestedFilename,
        });
        this.fileHandle = handle;
        this.writableStream = await handle.createWritable();
        return true;
      } catch {
        // User cancelled picker or permission denied -> fallback to Blob download
        this.fileHandle = null;
        this.writableStream = null;
      }
    }
    return false;
  }

  bindDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.onmessage = async (event) => {
      try {
        await this.handleFrameData(event.data);
      } catch (err) {
        if (this.onError) this.onError(err);
      }
    };
  }

  async handleFrameData(rawData) {
    if (this.isCancelled || this.isCompleted) return;

    if (!this.startTime) this.startTime = Date.now();

    const { isFinal, payload } = decodeFrame(rawData);

    if (payload && payload.byteLength > 0) {
      this.totalBytesReceived += payload.byteLength;

      if (this.writableStream) {
        this.pendingWriteBatch.push(payload);
        this.pendingWriteBytes += payload.byteLength;

        if (this.pendingWriteBytes >= this.MAX_WRITE_BATCH_BYTES || isFinal) {
          this.flushWriteBatch();
        }
      } else {
        this.chunks.push(payload);
      }
    }

    this.reportProgress();

    // Send periodic progress ACK back to sender every 512 KiB
    if (this.totalBytesReceived - this.lastAckBytes >= 512 * 1024) {
      this.lastAckBytes = this.totalBytesReceived;
      if (this.controlChannel && this.controlChannel.readyState === 'open') {
        try {
          this.controlChannel.send(JSON.stringify({
            type: 'progress',
            bytesReceived: this.totalBytesReceived,
          }));
        } catch {
          // ignore
        }
      }
    }

    if (isFinal) {
      await this.finishDownload();
    }
  }

  reportProgress() {
    const elapsedSec = (Date.now() - (this.startTime || Date.now())) / 1000;
    const speedBps = elapsedSec > 0 ? this.totalBytesReceived / elapsedSec : 0;
    const target = this.totalBytesExpected || this.totalBytesReceived || 1;
    const percent = Math.min(100, Math.round((this.totalBytesReceived / target) * 100));
    const remainingBytes = Math.max(0, target - this.totalBytesReceived);
    const timeRemainingSec = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;

    if (this.onProgress) {
      this.onProgress({
        bytesReceived: this.totalBytesReceived,
        totalSize: target,
        percent,
        speedBps,
        timeRemainingSec,
      });
    }
  }

  async finishDownload() {
    this.isCompleted = true;

    // Flush any pending write batch before closing stream
    this.flushWriteBatch();

    // Await all queued chunk writes before closing the stream
    if (this.writeQueue) {
      try {
        await this.writeQueue;
      } catch {
        // write errors handled in queue
      }
    }

    let resultBlob = null;

    if (this.writableStream) {
      try {
        await this.writableStream.close();
      } catch {
        // ignore
      }
      this.writableStream = null;
    } else {
      // Blob fallback: package chunks and trigger download
      const mimeType = this.isZip
        ? 'application/zip'
        : (this.manifest.files?.[0]?.type || 'application/octet-stream');

      resultBlob = new Blob(this.chunks, { type: mimeType });

      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        const url = URL.createObjectURL(resultBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = this.suggestedFilename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      }
    }

    // Acknowledge completion on control channel
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      try {
        this.controlChannel.send(JSON.stringify({
          type: 'complete',
          bytes: this.totalBytesReceived,
        }));
      } catch {
        // ignore
      }
    }

    if (this.onComplete) {
      this.onComplete({
        filename: this.suggestedFilename,
        totalBytes: this.totalBytesReceived,
        blob: resultBlob,
      });
    }
  }

  cancel() {
    this.isCancelled = true;
    this.pendingWriteBatch = [];
    this.pendingWriteBytes = 0;
    this.writeQueue = Promise.resolve();
    if (this.writableStream) {
      try { this.writableStream.abort(); } catch { /* ignore */ }
      this.writableStream = null;
    }
    this.chunks = [];
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      try {
        this.controlChannel.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // ignore
      }
    }
  }
}
