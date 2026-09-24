import { Zip, ZipPassThrough } from 'fflate';
import { encodeFrame, DEFAULT_CHUNK_SIZE } from './frame.js';

/**
 * Generate standard zip filename: SharePort-YYYYMMDD-HHMM.zip (PRD FL-2)
 */
export function generateZipFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `SharePort-${YYYY}${MM}${DD}-${HH}${mm}.zip`;
}

/**
 * Sanitize filename by stripping path traversal and control characters
 */
export function sanitizeFilename(name) {
  // eslint-disable-next-line no-control-regex
  let clean = (name || 'file').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').trim();
  if (!clean) clean = 'file';
  return clean;
}

/**
 * Deduplicate filenames (PRD FL-4)
 */
export function deduplicateFilenames(files) {
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

/**
 * Sender Pipeline (TRD Section 7.3)
 * Handles chunked streaming reads, backpressure, and streaming zip
 */
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

    if (this.dataChannel) {
      this.dataChannel.bufferedAmountLowThreshold = 256 * 1024; // 256 KiB
    }
  }

  cancel() {
    this.isCancelled = true;
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      try {
        this.controlChannel.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // ignore
      }
    }
  }

  async waitForBufferDrain() {
    if (!this.dataChannel || this.dataChannel.bufferedAmount <= 256 * 1024) return;
    return new Promise((resolve) => {
      const onLow = () => {
        this.dataChannel.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      this.dataChannel.addEventListener('bufferedamountlow', onLow);
    });
  }

  async sendFrame(payload, offset, isFinal) {
    if (this.isCancelled) throw new Error('Transfer cancelled');

    if (this.dataChannel.bufferedAmount > 1024 * 1024) {
      await this.waitForBufferDrain();
    }

    if (this.isCancelled) throw new Error('Transfer cancelled');

    const frame = encodeFrame(payload, offset, isFinal);
    this.dataChannel.send(frame);

    this.totalBytesSent += (payload ? payload.byteLength : 0);
    this.reportProgress();
  }

  reportProgress() {
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
        // Zero files: send empty final frame
        await this.sendFrame(new Uint8Array(0), 0, true);
      }

      if (!this.isCancelled) {
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

  /**
   * Stream a single file unchanged (PRD FL-1, TRD 7.3)
   */
  async streamSingleFile(file) {
    let offset = 0;
    const fileSize = file.size;

    // Handle 0-byte file (FL-4)
    if (fileSize === 0) {
      await this.sendFrame(new Uint8Array(0), 0, true);
      return;
    }

    while (offset < fileSize) {
      if (this.isCancelled) return;
      const end = Math.min(offset + DEFAULT_CHUNK_SIZE, fileSize);
      const slice = file.slice(offset, end);
      const buffer = await slice.arrayBuffer();
      const chunk = new Uint8Array(buffer);
      const isFinal = end >= fileSize;

      await this.sendFrame(chunk, offset, isFinal);
      offset = end;
    }
  }

  /**
   * Stream multiple files in a live fflate ZipPassThrough store-mode archive (PRD FL-2, TRD 7.3)
   */
  async streamMultiFileZip(files) {
    const deduplicated = deduplicateFilenames(files);
    let currentOffset = 0;
    let zipError = null;

    // We use a queue to send zip chunks to the data channel with backpressure
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

    // Worker promise: reads files and feeds them into zip entries sequentially
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

          // If sender data channel is heavily backed up, yield briefly
          if (this.dataChannel.bufferedAmount > 512 * 1024) {
            await this.waitForBufferDrain();
          }
        }
      }
      zip.end();
    })();

    // Consumer loop: drains chunkQueue and sends frames over dataChannel
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
