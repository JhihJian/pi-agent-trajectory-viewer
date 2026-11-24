import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_WINDOW_BYTES, MAX_WINDOW_BYTES, growWindow, readTailWindow, readVersion, versionChanged } from '../src/lib/tail-window.js'

const lines = (count, prefix = 'row') => `${Array.from({ length: count }, (_, index) => `{"i":${index + 1},"t":"${prefix}"}`).join('\n')}\n`

test('tail window reads only the last complete lines within the byte budget', () => {
  const read = readTailWindow(lines(40), { windowBytes: 240 })
  assert.ok(read.lines.length < 40)
  assert.equal(read.lastLineNumber, 40)
  assert.equal(read.lines.at(-1).lineNumber, 40)
  assert.equal(read.reachedStart, false)
  assert.equal(read.lines.every((line) => line.text.startsWith('{')), true)
})

test('the whole file fits when the window covers it and reachedStart is reported', () => {
  const read = readTailWindow(lines(4), { windowBytes: DEFAULT_WINDOW_BYTES })
  assert.equal(read.lines.length, 4)
  assert.equal(read.firstLineNumber, 1)
  assert.equal(read.reachedStart, true)
})

test('a trailing chunk without newline is an unfinished record: skipped, reported honestly', () => {
  const read = readTailWindow(`${lines(3)}\n{"partial":"rec`, { windowBytes: DEFAULT_WINDOW_BYTES })
  assert.equal(read.lines.length, 3)
  assert.equal(read.incompleteTail, true)
  assert.equal(read.totalLines, 3)
  assert.equal(readTailWindow(`${lines(3)}\n`).incompleteTail, false)
})

test('blank lines are ignored and line numbers refer to the original file', () => {
  const read = readTailWindow('{"i":1}\n\n{"i":2}\n\n{"i":3}\n', { windowBytes: DEFAULT_WINDOW_BYTES })
  assert.deepEqual(read.lines.map((line) => [line.lineNumber, line.text]), [[1, '{"i":1}'], [2, '{"i":2}'], [3, '{"i":3}']])
})

test('grow window doubles up to the maximum', () => {
  assert.equal(growWindow(DEFAULT_WINDOW_BYTES), DEFAULT_WINDOW_BYTES * 2)
  assert.equal(growWindow(MAX_WINDOW_BYTES + 1), MAX_WINDOW_BYTES)
})

test('read version tracks size and modified and invalidates stale presentations', () => {
  const version = readVersion({ size: 100, modified: 5 })
  assert.match(version, /^size:100:modified:5$/)
  assert.equal(versionChanged({ size: 100, modified: 5 }, version), false)
  assert.equal(versionChanged({ size: 240, modified: 5 }, version), true)
})
