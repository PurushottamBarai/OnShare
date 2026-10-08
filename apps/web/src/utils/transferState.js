// Utility to track active transfer status across routes without unmounting components
const listeners = new Set();

let currentStatus = {
  isActive: false,
  role: null, // 'sender' | 'receiver'
  progress: 0,
  details: '',
};

export const getTransferStatus = () => currentStatus;

export const setTransferStatus = (update) => {
  if (typeof update === 'function') {
    currentStatus = update(currentStatus);
  } else {
    currentStatus = { ...currentStatus, ...update };
  }
  listeners.forEach((cb) => {
    try {
      cb(currentStatus);
    } catch {
      // ignore
    }
  });
};

export const subscribeTransferStatus = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
