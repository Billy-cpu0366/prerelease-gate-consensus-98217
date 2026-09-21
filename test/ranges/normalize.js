'use strict'

const { test } = require('tap')
const normalize = require('../../ranges/normalize')

test('equivalent spellings normalize to the same output', (t) => {
  const groups = [
    ['~1.2.3', '>=1.2.3 <1.3.0-0'],
    ['1.2.x', '1.2.*', '>=1.2.0 <1.3.0-0', '~1.2'],
    ['^1.2.3', '>=1.2.3 <2.0.0-0'],
    ['1.2.3 - 2.3.4', '>=1.2.3 <=2.3.4'],
    ['*', '', 'x'],
  ]
  for (const group of groups) {
    const normalized = group.map((r) => normalize(r))
    for (const n of normalized) {
      t.equal(n, normalized[0], `${group.join(' / ')} all normalize alike`)
    }
  }
  t.end()
})

test('build metadata does not participate', (t) => {
  t.equal(normalize('1.2.3+build.1'), normalize('1.2.3'))
  t.equal(normalize('>=1.2.3+foo <2.0.0+bar'), normalize('>=1.2.3 <2.0.0'))
  t.end()
})

test('invalid input returns null instead of throwing', (t) => {
  t.equal(normalize('not a range at all'), null)
  t.equal(normalize('>=1.2.3 <'), null)
  t.equal(normalize(null), null)
  t.end()
})

test('normalize is idempotent and deterministic', (t) => {
  const cases = [
    '>=1.2.3 <2.0.0-0 || 3.x',
    '1.2.3 - 4.5.6 || ~2.0.1 || ^0.1.2',
    '>1.0.0-alpha <1.0.0',
    '*',
  ]
  for (const c of cases) {
    const once = normalize(c)
    t.equal(normalize(once), once, `normalize(${c}) is a fixed point`)
    t.equal(normalize(c), once, `normalize(${c}) is deterministic`)
  }
  t.end()
})

test('comparator and set ordering is canonical', (t) => {
  t.equal(normalize('<2.0.0 >=1.0.0'), normalize('>=1.0.0 <2.0.0'))
  t.equal(normalize('>=2.0.0 || >=1.0.0 <2.0.0'),
    normalize('>=1.0.0 <2.0.0 || >=2.0.0'))
  t.equal(normalize('>=1.0.0 >=1.0.0 <2.0.0'), normalize('>=1.0.0 <2.0.0'))
  t.end()
})
