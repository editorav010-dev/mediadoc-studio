const pendingInputs = new Map();
const outputChunkSize = 500000;  // 500KB chunks (increased from 160KB for better performance)
let pandocModulePromise = null;

function postMessage(type, payload = {}) {
  if (
    typeof window.PandocBridge !== 'undefined' &&
    typeof window.PandocBridge.postMessage === 'function'
  ) {
    window.PandocBridge.postMessage(JSON.stringify({ type, ...payload }));
  }
}

// Intercept console messages and send to Flutter (DISABLED in production for performance)
(function() {
    // Only enable console interception in debug mode for performance
    const ENABLE_CONSOLE_BRIDGE = false; // Set to true for debugging only
    
    if (!ENABLE_CONSOLE_BRIDGE) {
        return; // Skip console interception in production
    }
    
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = function(...args) {
        postMessage('log', { level: 'log', message: args.join(' ') });
        originalLog.apply(console, args);
    };
    console.warn = function(...args) {
        postMessage('log', { level: 'warn', message: args.join(' ') });
        originalWarn.apply(console, args);
    };
    console.error = function(...args) {
        postMessage('log', { level: 'error', message: args.join(' ') });
        originalError.apply(console, args);
    };
})();

function normalizeExtension(extension) {
  return String(extension || '').toLowerCase().replace(/^\./, '');
}

async function loadPandocModule() {
  if (!pandocModulePromise) {
    postMessage('status', { message: 'Initializing Pandoc runtime...' });
    console.log('[Bridge] Starting dynamic import of pandoc.js...');
    pandocModulePromise = import('./pandoc.js').catch((error) => {
      console.error('[Bridge] Failed to import pandoc.js:', error);
      console.error('[Bridge] Error name:', error.name);
      console.error('[Bridge] Error message:', error.message);
      console.error('[Bridge] Error stack:', error.stack);
      pandocModulePromise = null;
      throw error;
    });
  }

  return pandocModulePromise;
}

function inputFormatForExtension(extension) {
  switch (normalizeExtension(extension)) {
    case 'docx':
      return 'docx';
    case 'odt':
      return 'odt';
    case 'rtf':
      return 'rtf';
    case 'html':
    case 'htm':
      return 'html';
    case 'epub':
      return 'epub';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'markdown';
    default:
      throw new Error(`Unsupported input format: .${extension}`);
  }
}

function outputFormatForExtension(extension) {
  switch (normalizeExtension(extension)) {
    case 'docx':
      return 'docx';
    case 'odt':
      return 'odt';
    case 'rtf':
      return 'rtf';
    case 'html':
      return 'html';
    case 'epub':
      return 'epub';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'plain';
    default:
      throw new Error(`Unsupported output format: .${extension}`);
  }
}

function mimeTypeForExtension(extension) {
  switch (normalizeExtension(extension)) {
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'odt':
      return 'application/vnd.oasis.opendocument.text';
    case 'rtf':
      return 'application/rtf';
    case 'html':
      return 'text/html';
    case 'epub':
      return 'application/epub+zip';
    case 'md':
    case 'markdown':
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

function base64ToUint8Array(base64) {
  if (!base64) {
    return new Uint8Array();
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  if (!bytes || bytes.length === 0) {
    return '';
  }

  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

async function nextFrame() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function sendResultInChunks({
  requestId,
  base64Data,
  fileName,
  mimeType,
  stderr,
  warnings,
}) {
  const totalChunks = Math.max(1, Math.ceil(base64Data.length / outputChunkSize));
  postMessage('result_start', {
    requestId,
    totalChunks,
    fileName,
    mimeType,
    stderr,
    warnings,
  });

  if (base64Data.length === 0) {
    postMessage('result_chunk', { requestId, index: 0, chunk: '' });
  } else {
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * outputChunkSize;
      const end = start + outputChunkSize;
      postMessage('result_chunk', {
        requestId,
        index,
        chunk: base64Data.slice(start, end),
      });
      if ((index + 1) % 4 === 0) {
        await nextFrame();
      }
    }
  }

  postMessage('result_complete', { requestId });
}

window.formaticaResetInput = function formaticaResetInput(requestId) {
  pendingInputs.set(requestId, []);
};

window.formaticaReceiveChunk = function formaticaReceiveChunk(requestId, chunk) {
  const currentChunks = pendingInputs.get(requestId) || [];
  currentChunks.push(chunk || '');
  pendingInputs.set(requestId, currentChunks);
};

window.formaticaFinalizeRequest = async function formaticaFinalizeRequest(payload) {
  const request = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const requestId = request.requestId;
  const inputBase64 = (pendingInputs.get(requestId) || []).join('');
  pendingInputs.delete(requestId);

  try {
    postMessage('progress', {
      requestId,
      progress: 0.10,
      stage: 'Preparing Pandoc...',
    });

    const inputBytes = base64ToUint8Array(inputBase64);
    const options = {
      ...(request.extraOptions || {}),
      from: inputFormatForExtension(request.inputExtension),
      to: outputFormatForExtension(request.outputExtension),
      standalone: true,
      'input-files': [request.inputFileName],
      'output-file': request.outputFileName,
    };
    const files = {
      [request.inputFileName]: new Blob([inputBytes], {
        type: mimeTypeForExtension(request.inputExtension),
      }),
    };

    postMessage('progress', {
      requestId,
      progress: 0.55,
      stage: 'Converting with Pandoc...',
    });

    const { convert } = await loadPandocModule();
    
    console.log(`[Bridge] Starting conversion: ${request.inputFileName} -> ${request.outputFileName}`);
    console.log(`[Bridge] Options:`, options);
    
    const startTime = Date.now();
    const result = await convert(options, null, files);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`[Bridge] Conversion completed in ${elapsed}s`);
    console.log(`[Bridge] Stderr:`, result.stderr);
    console.log(`[Bridge] Warnings:`, result.warnings);
    
    if (result.stderr && /\bERROR\b/i.test(result.stderr)) {
      console.error(`[Bridge] Conversion ERROR detected in stderr`);
      throw new Error(result.stderr.trim());
    }

    let outputBlob = files[request.outputFileName];
    if (!outputBlob && result.stdout) {
      outputBlob = new Blob([result.stdout], {
        type: mimeTypeForExtension(request.outputExtension),
      });
    }
    if (!outputBlob) {
      throw new Error('Pandoc did not produce an output file.');
    }

    postMessage('progress', {
      requestId,
      progress: 0.82,
      stage: 'Packaging output...',
    });

    const outputBase64 = await blobToBase64(outputBlob);
    await sendResultInChunks({
      requestId,
      base64Data: outputBase64,
      fileName: request.outputFileName,
      mimeType: mimeTypeForExtension(request.outputExtension),
      stderr: result.stderr || '',
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    });
  } catch (error) {
    postMessage('error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

(async () => {
  postMessage('status', { message: 'Loading bundled Pandoc engine...' });
  console.log('[Bridge] Starting initialization sequence');
  try {
    console.log('[Bridge] Loading pandoc.js module...');
    const { query } = await loadPandocModule();
    console.log('[Bridge] pandoc.js module loaded successfully');
    
    postMessage('status', { message: 'Finishing Pandoc startup...' });
    
    console.log('[Bridge] Querying pandoc version...');
    try {
      const versionResult = await query({ query: 'version' });
      console.log('[Bridge] Pandoc version result:', versionResult);
      postMessage('ready', { version: versionResult });
    } catch (queryError) {
      console.warn('[Bridge] Version query failed, but engine might be usable:', queryError);
      postMessage('ready', { version: '1.0.0 (WASM)' });
    }
  } catch (error) {
    console.error('[Bridge] Fatal initialization error:', error);
    postMessage('fatal', {
      message:
        error instanceof Error
          ? `Bundled Pandoc failed to start: ${error.message}`
          : `Bundled Pandoc failed to start: ${String(error)}`,
    });
  }
})();
