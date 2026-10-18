import { Zip, ZipPassThrough } from 'fflate';
import { encodeFrame, DEFAULT_CHUNK_SIZE } from './frame.js';

export function generateZipFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `OnShare-${YYYY}${MM}${DD}-${HH}${mm}.zip`;
}

export function sanitizeFilename(name) {
  let clean = (name || 'file').replace(/[\\/:*?"<>|]/g, '_').split('').filter(ch => ch.charCodeAt(0) >= 32).join('').trim();
  if (!clean) clean = 'file';
  return clean;
}

function deduplicateFilenames(files) {
  const seen = new Map();
  return files.map(file => {
    const clean = sanitizeFilename(file.name);
    const lastDot = clean.lastIndexOf('.');
    const base = lastDot > 0 ? clean.slice(0, lastDot) : clean;
    const ext = lastDot > 0 ? clean.slice(lastDot) : '';

    let candidate = clean;
    const count = seen.get(clean) || 0;
    if (count > 0) {
      candidate = `${base} (${count})${ext}`;
    }
    seen.set(clean, count + 1);
    return {
      file,
      sanitizedName: candidate,
    };
  });
}

export class SenderPipeline {
  constructor({ dataChannel, controlChannel, files, onProgress, onComplete, onError }) {
    this.dataChannel = dataChannel;
    this.controlChannel = controlChannel;
    this.files = files || [];
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    this.isCancelled = false;
    this.totalBytesSent = 0;
    this.totalBytesTarget = this.files.reduce((acc, f) => acc + (f.size || 0), 0);
    this.startTime = null;

    this.receiverAcknowledgedBytes = 0;
    this.notifyAckReceived = null;

    this.lastProgressReportTime = 0;
    this.PROGRESS_THROTTLE_MS = 200;

    if (this.controlChannel) {
      this.handleControlMessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'progress' && typeof msg.bytesReceived === 'number') {
            this.receiverAcknowledgedBytes = msg.bytesReceived;
            if (this.notifyAckReceived) {
              this.notifyAckReceived();
              this.notifyAckReceived = null;
            }
          }
        } catch {
          void 0;
        }
      };
      this.controlChannel.addEventListener('message', this.handleControlMessage);
    }

    if (this.dataChannel) {
      this.dataChannel.bufferedAmountLowThreshold = 2 * 1024 * 1024;
    }
  }

  cancel() {
    this.isCancelled = true;
    if (this.notifyAckReceived) {
      this.notifyAckReceived();
      this.notifyAckReceived = null;
    }
    if (this.controlChannel) {
      if (this.handleControlMessage) {
        this.controlChannel.removeEventListener('message', this.handleControlMessage);
      }
      if (this.controlChannel.readyState === 'open') {
        try {
          this.controlChannel.send(JSON.stringify({ type: 'cancel' }));
        } catch {
          void 0;
        }
      }
    }
  }

  async waitForBufferDrain() {
    const lowWaterMark = 2 * 1024 * 1024;
    if (!this.dataChannel || this.dataChannel.bufferedAmount <= lowWaterMark) return;
    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (timer) clearInterval(timer);
        this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };

      const onLow = () => cleanup();

      this.dataChannel.addEventListener('bufferedamountlow', onLow);

      timer = setInterval(() => {
        if (
          !this.dataChannel ||
          this.dataChannel.readyState !== 'open' ||
          this.dataChannel.bufferedAmount <= lowWaterMark ||
          this.isCancelled
        ) {
          cleanup();
        }
      }, 15);
    });
  }

  async sendFrame(payload, offset, isFinal) {
    if (this.isCancelled) throw new Error('Transfer cancelled');

    if (this.dataChannel.bufferedAmount > 4 * 1024 * 1024) {
      await this.waitForBufferDrain();
    }

    if (this.isCancelled) throw new Error('Transfer cancelled');

    const frame = encodeFrame(payload, offset, isFinal);
    this.dataChannel.send(frame);

    this.totalBytesSent += (payload ? payload.byteLength : 0);
    this.reportProgress(isFinal);
  }

  reportProgress(force = false) {
    const now = performance.now();
    if (!force && this.lastProgressReportTime && (now - this.lastProgressReportTime < this.PROGRESS_THROTTLE_MS)) {
      return;
    }
    this.lastProgressReportTime = now;

    if (!this.startTime) this.startTime = Date.now();
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const speedBps = elapsedSec > 0 ? this.totalBytesSent / elapsedSec : 0;
    const target = this.totalBytesTarget || this.totalBytesSent || 1;
    const percent = Math.min(100, Math.round((this.totalBytesSent / target) * 100));
    const remainingBytes = Math.max(0, target - this.totalBytesSent);
    const timeRemainingSec = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;

    if (this.onProgress) {
      this.onProgress({
        bytesSent: this.totalBytesSent,
        totalSize: target,
        percent,
        speedBps,
        timeRemainingSec,
      });
    }
  }

  async start() {
    this.startTime = Date.now();
    try {
      if (this.files.length === 1) {
        await this.streamSingleFile(this.files[0]);
      } else if (this.files.length > 1) {
        await this.streamMultiFileZip(this.files);
      } else {
        await this.sendFrame(new Uint8Array(0), 0, true);
      }

      if (!this.isCancelled) {
        this.reportProgress(true);
        if (this.onComplete) {
          this.onComplete({ totalBytes: this.totalBytesSent });
        }
      }
    } catch (err) {
      if (!this.isCancelled && this.onError) {
        this.onError(err);
      }
    }
  }

  async streamSingleFile(file) {
    const fileSize = file.size;

    if (fileSize === 0) {
      await this.sendFrame(new Uint8Array(0), 0, true);
      return;
    }

    const BLOCK_READ_SIZE = 1024 * 1024;
    let fileOffset = 0;

    while (fileOffset < fileSize) {
      if (this.isCancelled) return;
      const blockEnd = Math.min(fileOffset + BLOCK_READ_SIZE, fileSize);
      const slice = file.slice(fileOffset, blockEnd);
      const buffer = await slice.arrayBuffer();
      const blockBytes = new Uint8Array(buffer);

      let innerOffset = 0;
      while (innerOffset < blockBytes.byteLength) {
        if (this.isCancelled) return;
        const chunkEnd = Math.min(innerOffset + DEFAULT_CHUNK_SIZE, blockBytes.byteLength);
        const chunkPayload = blockBytes.subarray(innerOffset, chunkEnd);
        const isFinal = (fileOffset + chunkEnd) >= fileSize;

        await this.sendFrame(chunkPayload, fileOffset + innerOffset, isFinal);
        innerOffset = chunkEnd;
      }
      fileOffset = blockEnd;
    }
  }

  async streamMultiFileZip(files) {
    const deduplicated = deduplicateFilenames(files);
    let currentOffset = 0;
    let zipError = null;

    const chunkQueue = [];
    let isZipFinished = false;
    let notifyChunkAvailable = null;

    const zip = new Zip((err, chunk, isFinal) => {
      if (err) {
        zipError = err;
        return;
      }
      chunkQueue.push({ chunk, isFinal });
      if (notifyChunkAvailable) {
        notifyChunkAvailable();
        notifyChunkAvailable = null;
      }
      if (isFinal) {
        isZipFinished = true;
      }
    });

    const feedFilesPromise = (async () => {
      for (const item of deduplicated) {
        if (this.isCancelled || zipError) break;

        const { file, sanitizedName } = item;
        const entry = new ZipPassThrough(sanitizedName);
        zip.add(entry);

        const fileSize = file.size;
        let fileOffset = 0;

        if (fileSize === 0) {
          entry.push(new Uint8Array(0), true);
          continue;
        }

        while (fileOffset < fileSize) {
          if (this.isCancelled || zipError) break;
          const end = Math.min(fileOffset + DEFAULT_CHUNK_SIZE, fileSize);
          const slice = file.slice(fileOffset, end);
          const buffer = await slice.arrayBuffer();
          const chunk = new Uint8Array(buffer);
          const isFileFinal = end >= fileSize;

          entry.push(chunk, isFileFinal);
          fileOffset = end;

          if (this.dataChannel.bufferedAmount > 512 * 1024) {
            await this.waitForBufferDrain();
          }
        }
      }
      zip.end();
    })();

    while (!this.isCancelled) {
      if (zipError) throw zipError;

      if (chunkQueue.length > 0) {
        const item = chunkQueue.shift();
        await this.sendFrame(item.chunk, currentOffset, item.isFinal);
        currentOffset += item.chunk.byteLength;
        if (item.isFinal) {
          break;
        }
      } else if (isZipFinished) {
        break;
      } else {
        await new Promise((resolve) => {
          notifyChunkAvailable = resolve;
        });
      }
    }

    await feedFilesPromise;
  }
}
