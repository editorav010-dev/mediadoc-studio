// debug.js: Debug utilities for WASI
// Provides conditional logging based on debug mode

let debugEnabled = false;

export const debug = {
  get enabled() {
    return debugEnabled;
  },
  enable(value) {
    debugEnabled = value === true;
  },
  log(...args) {
    if (debugEnabled) {
      console.log('[WASI]', ...args);
    }
  }
};

export default debug;
