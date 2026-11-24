// Tail-window session reading, adapted from the codex-session-renderer tail
// reader (src/jsonl-tail-reader.mjs and src/session-detail-query-service.mjs):
// read only the last window of a session file, parse only complete records,
// report an unfinished trailing record honestly, and hand out a read version
// (size + modified) that invalidates stale presentations.

export const DEFAULT_WINDOW_BYTES = 32768
export const MAX_WINDOW_BYTES = 4 * 1024 * 1024

const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder()
const byteLength = (text) => (encoder ? encoder.encode(text).length : text.length)

export function readVersion({ size, modified } = {}) {
  return `size:${size ?? 0}:modified:${modified ?? 0}`
}

export function versionChanged(current, presented) {
  return readVersion(current) !== presented
}

// Reads the tail window of a JSONL session. The trailing chunk without a
// newline is an unfinished record: it is excluded from lines and reported via
// incompleteTail instead of being parsed or silently dropped.
export function readTailWindow(text, { windowBytes = DEFAULT_WINDOW_BYTES, maxWindowBytes = MAX_WINDOW_BYTES } = {}) {
  const source = String(text ?? '')
  let body = source
  let incompleteTail = false
  if (source && !/\r?\n$/.test(source)) {
    // The file does not end with a newline: the last chunk is a half-written record.
    incompleteTail = true
    body = source.slice(0, Math.max(source.lastIndexOf('\n'), source.lastIndexOf('\r')) + 1)
  }
  const completeLines = body.split(/\r?\n/).filter((line) => line.trim() !== '')
  const windowed = []
  let bytes = 0
  let firstLineNumber = completeLines.length
  for (let index = completeLines.length - 1; index >= 0; index -= 1) {
    const lineBytes = byteLength(completeLines[index]) + 1
    if (windowed.length && bytes + lineBytes > windowBytes) break
    windowed.unshift({ lineNumber: index + 1, text: completeLines[index] })
    bytes += lineBytes
    firstLineNumber = index + 1
  }
  return {
    lines: windowed,
    firstLineNumber,
    lastLineNumber: completeLines.length,
    totalLines: completeLines.length,
    reachedStart: firstLineNumber === 1,
    incompleteTail,
    windowBytes: Math.min(windowBytes, maxWindowBytes),
    totalBytes: byteLength(String(text ?? '')),
  }
}

export function growWindow(windowBytes, { maxWindowBytes = MAX_WINDOW_BYTES } = {}) {
  return Math.min(windowBytes * 2, maxWindowBytes)
}
