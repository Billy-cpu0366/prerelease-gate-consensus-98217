'use strict'

const { test } = require('tap')
const Range = require('../../classes/range')
const {
  canonicalSet,
  canonicalSets,
  formatSet,
  formatRange,
} = require('../../internal/canonical')

test('canonicalSet dedupes, drops ANY, and sorts deterministically', (t) => {
  const range = new Range('<2.0.0 >=1.0.0 >=1.0.0')
  const set = canonicalSet(range.set[0])
  t.equal(formatSet(set), '>=1.0.0 <2.0.0')

  const withAny = new Range('>=1.0.0')
  t.equal(formatSet(canonicalSet(withAny.set[0])), '>=1.0.0')

  const any = new Range('*')
  t.equal(formatSet(canonicalSet(any.set[0])), '')
  t.end()
})

test('canonicalSet ordering is stable across input order', (t) => {
  const a = canonicalSets(new Range('>1.0.0 >=1.0.0 <=2.0.0 <3.0.0'))
  const b = canonicalSets(new Range('<3.0.0 <=2.0.0 >=1.0.0 >1.0.0'))
  t.equal(formatSet(a[0]), formatSet(b[0]))
  t.end()
})

test('formatRange dedupes and sorts sets, * for the empty string', (t) => {
  const sets = canonicalSets(new Range('>=2.0.0 || >=1.0.0 || >=1.0.0'))
  t.equal(formatRange(sets), '>=1.0.0||>=2.0.0')
  t.equal(formatRange(canonicalSets(new Range('*'))), '*')
  t.end()
})
