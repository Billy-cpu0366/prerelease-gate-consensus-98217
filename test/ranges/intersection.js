'use strict'

const { test } = require('tap')
const intersection = require('../../ranges/intersection')
const normalize = require('../../ranges/normalize')
const satisfies = require('../../functions/satisfies')

test('basic intersections', (t) => {
  const cases = [
    [['>=1.0.0 <2.0.0', '>=1.5.0'], '1.7.0', '0.5.0'],
    [['^1.2.3', '~1.2.5'], '1.2.9', '1.3.0'],
    [['1.2.3', '1.2.3'], '1.2.3', '1.2.4'],
    [['*', '>=1.0.0'], '1.0.0', null],
  ]
  for (const [ranges, yes, no] of cases) {
    const res = intersection(...ranges)
    t.ok(res, `intersection of ${ranges.join(' & ')} is non-empty`)
    t.ok(res.test(yes), `${yes} satisfies the intersection`)
    if (no) {
      t.notOk(res.test(no), `${no} does not satisfy the intersection`)
    }
  }
  t.end()
})

test('empty intersections return null and are not widened', (t) => {
  t.equal(intersection('>4 <3', '>=1.0.0'), null)
  t.equal(intersection('1.2.3', '1.2.4'), null)
  t.equal(intersection('>=2.0.0', '<2.0.0'), null)
  t.equal(intersection('<0.0.0-0', '*'), null)
  t.end()
})

test('invalid input returns null instead of throwing', (t) => {
  t.equal(intersection('garbage range', '>=1.0.0'), null)
  t.equal(intersection(), null)
  t.end()
})

test('order of ranges does not change the result', (t) => {
  const a = intersection('^1.0.0 || ^2.0.0', '>=1.5.0 <2.5.0', '<2.4.0')
  const b = intersection('<2.4.0', '>=1.5.0 <2.5.0', '^1.0.0 || ^2.0.0')
  t.equal(String(a), String(b))
  t.end()
})

test('intersection with self is identity', (t) => {
  const ranges = ['^1.2.3', '1.2.3 - 2.3.4', '>=1.0.0-alpha <2.0.0', '*']
  for (const r of ranges) {
    t.equal(normalize(intersection(r, r)), normalize(r), `${r} & ${r} = ${r}`)
  }
  t.end()
})

test('intersection only ever narrows', (t) => {
  const versions = ['0.9.0', '1.0.0', '1.2.3-alpha', '1.2.3', '1.5.0', '2.0.0', '2.5.0']
  const r1 = '>=1.0.0 <2.0.0'
  const r2 = '>=1.2.3-alpha'
  const both = intersection(r1, r2)
  for (const v of versions) {
    if (both.test(v)) {
      t.ok(satisfies(v, r1) && satisfies(v, r2), `${v} in intersection implies in both`)
    }
    if (satisfies(v, r1) && satisfies(v, r2)) {
      t.ok(both.test(v), `${v} in both implies in intersection`)
    }
  }
  t.end()
})

test('prerelease gating matches satisfies/subset consensus', (t) => {
  // a prerelease is only allowed when a comparator with the same
  // [major, minor, patch] tuple explicitly mentions a prerelease
  const gated = intersection('>=1.2.3-alpha', '>=1.0.0')
  t.notOk(gated.test('1.2.4-alpha'), 'higher tuple prerelease stays gated')
  t.notOk(gated.test('1.2.3-beta'),
    'tuple admitted by only one side stays gated in the intersection')
  t.ok(gated.test('1.2.3'), 'release at the boundary allowed')
  t.ok(gated.test('1.2.4'), 'releases unaffected')

  const admitted = intersection('>=1.2.3-alpha', '>=1.2.3-0 <2.0.0')
  t.ok(admitted.test('1.2.3-beta'), 'tuple admitted by both sides allowed')
  t.notOk(admitted.test('1.2.4-alpha'), 'higher tuple prerelease still gated')
  t.end()
})

test('result feeds back through normalize as a fixed point', (t) => {
  const res = intersection('^1.0.0 || ^2.0.0', '>=1.5.0 <2.5.0')
  t.equal(normalize(res), normalize(String(res)))
  t.equal(normalize(normalize(res)), normalize(res))
  t.end()
})
