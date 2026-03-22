import assert from 'node:assert/strict'
import test from 'node:test'
import { createToolRequestStreamTruncator, detectToolRequestBlock } from '../dist/index.js'

function normText(input) {
  return typeof input === 'string' ? input : String(input ?? '')
}

function baselineCreate(initialText) {
  return {
    out: normText(initialText),
    completed: false,
  }
}

function baselineAppend(state, delta) {
  if (state.completed) {
    const detected = detectToolRequestBlock(state.out)
    return { text: state.out, detected, toolRequestCompleted: true }
  }

  const add = normText(delta)
  if (!add) {
    const detected = detectToolRequestBlock(state.out)
    return { text: state.out, detected, toolRequestCompleted: false }
  }

  const nextOut = state.out + add
  const detected = detectToolRequestBlock(nextOut)
  if (detected.status === 'complete') {
    state.out = detected.keptText
    state.completed = true
    return { text: state.out, detected, toolRequestCompleted: true }
  }

  state.out = nextOut
  return { text: state.out, detected, toolRequestCompleted: false }
}

function xorshift32(seed) {
  let x = seed >>> 0
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return x >>> 0
  }
}

function splitIntoChunks(s, rng, maxChunk) {
  const out = []
  let i = 0
  while (i < s.length) {
    const n = 1 + (rng() % maxChunk)
    out.push(s.slice(i, i + n))
    i += n
  }
  return out
}

function runEquivalenceCase({ initialText, fullText, seed, maxChunk }) {
  const baseline = baselineCreate(initialText)
  const fast = createToolRequestStreamTruncator(initialText)

  const rng = xorshift32(seed)
  const chunks = splitIntoChunks(fullText, rng, maxChunk)

  for (const c of chunks) {
    const a = baselineAppend(baseline, c)
    const b = fast.appendDelta(c)
    assert.equal(b.text, a.text)
    assert.equal(b.toolRequestCompleted, a.toolRequestCompleted)
    assert.deepStrictEqual(b.detected, a.detected)
  }

  // Also verify empty delta behavior.
  const a2 = baselineAppend(baseline, '')
  const b2 = fast.appendDelta('')
  assert.equal(b2.text, a2.text)
  assert.equal(b2.toolRequestCompleted, a2.toolRequestCompleted)
  assert.deepStrictEqual(b2.detected, a2.detected)
}

test('createToolRequestStreamTruncator: stream semantics match baseline (random chunking)', () => {
  const OPEN = '<<<[TOOL_REQUEST]>>>'
  const CLOSE = '<<<[END_TOOL_REQUEST]>>>'

  const cases = [
    {
      name: 'no markers',
      initialText: '',
      fullText: 'hello world\nthis is a normal assistant message.\n',
    },
    {
      name: 'incomplete tool request',
      initialText: '',
      fullText: `prefix\n${OPEN}\n  <<[CALL-1]>>\n    tool_name:「start」echo「end」\n  <<[/CALL-1]>>\n`,
    },
    {
      name: 'complete tool request (no trailing)',
      initialText: '',
      fullText: `prefix\n${OPEN}\n  <<[CALL-1]>>\n    tool_name:「start」echo「end」\n    text:「start」A「end」\n  <<[/CALL-1]>>\n${CLOSE}`,
    },
    {
      name: 'complete tool request (with trailing)',
      initialText: '',
      fullText: `prefix\n${OPEN}\n  <<[CALL-1]>>\n    tool_name:「start」echo「end」\n    text:「start」A「end」\n  <<[/CALL-1]>>\n${CLOSE}\nthis part must be truncated\n`,
    },
    {
      name: 'initialText already contains complete block',
      initialText: `p\n${OPEN}\n${CLOSE}\n`,
      fullText: 'tail that should be truncated immediately',
    },
  ]

  let seed = 123
  for (const c of cases) {
    for (let i = 0; i < 50; i++) {
      runEquivalenceCase({
        initialText: c.initialText,
        fullText: c.fullText,
        seed: seed++,
        maxChunk: 25,
      })
    }
  }
})

