'use strict'

const { test } = require('tap')
const minVersion = require('../../ranges/min-version')

test('minimum version in range tests', (t) => {
  // [range, minimum, loose]
  [
    // Stars
    ['*', '0.0.0'],
    ['* || >=2', '0.0.0'],
    ['>=2 || *', '0.0.0'],
    ['>2 || *', '0.0.0'],

    // equal
    ['1.0.0', '1.0.0'],
    ['1.0', '1.0.0'],
    ['1.0.x', '1.0.0'],
    ['1.0.*', '1.0.0'],
    ['1', '1.0.0'],
    ['1.x.x', '1.0.0'],
    ['1.x.x', '1.0.0'],
    ['1.*.x', '1.0.0'],
    ['1.x.*', '1.0.0'],
    ['1.x', '1.0.0'],
    ['1.*', '1.0.0'],
    ['=1.0.0', '1.0.0'],

    // Tilde
    ['~1.1.1', '1.1.1'],
    ['~1.1.1-beta', '1.1.1-beta'],
    ['~1.1.1 || >=2', '1.1.1'],

    // Caret
    ['^1.1.1', '1.1.1'],
    ['^1.1.1-beta', '1.1.1-beta'],
    ['^1.1.1 || >=2', '1.1.1'],
    ['^2.16.2 ^2.16', '2.16.2'],

    // '-' operator
    ['1.1.1 - 1.8.0', '1.1.1'],
    ['1.1 - 1.8.0', '1.1.0'],

    // Less / less or equal
    ['<2', '0.0.0'],
    ['<0.0.0-beta', '0.0.0-0'],
    ['<0.0.1-beta', '0.0.0'],
    ['<2 || >4', '0.0.0'],
    ['>4 || <2', '0.0.0'],
    ['<=2 || >=4', '0.0.0'],
    ['>=4 || <=2', '0.0.0'],
    ['<0.0.0-beta >0.0.0-alpha', '0.0.0-alpha.0'],
    ['>0.0.0-alpha <0.0.0-beta', '0.0.0-alpha.0'],

    // Greater than or equal
    ['>=1.1.1 <2 || >=2.2.2 <2', '1.1.1'],
    ['>=2.2.2 <2 || >=1.1.1 <2', '1.1.1'],

    // Greater than but not equal
    ['>1.0.0', '1.0.1'],
    ['>1.0.0-0', '1.0.0-0.0'],
    ['>1.0.0-beta', '1.0.0-beta.0'],
    ['>2 || >1.0.0', '1.0.1'],
    ['>2 || >1.0.0-0', '1.0.0-0.0'],
    ['>2 || >1.0.0-beta', '1.0.0-beta.0'],

    // Impossible range
    ['>4 <3', null],
  ].forEach((tuple) => {
    const range = tuple[0]
    const version = tuple[1]
    const loose = tuple[2] || false
    const msg = `minVersion(${range}, ${loose}) = ${version}`
    const min = minVersion(range, loose)
    t.ok(min === version || (min && min.version === version), msg, {
      found: min,
      wanted: version,
    })
  })
  t.end()
})

test('minVersion explain reports blockers when unsatisfiable', (t) => {
  const minVersionExplain = require('../../ranges/min-version')
  const ok = minVersionExplain.explain('^1.2.3')
  t.equal(ok.version.version, '1.2.3')
  t.same(ok.blockers, [])

  const blocked = minVersionExplain.explain('>4 <3')
  t.equal(blocked.version, null)
  t.ok(blocked.blockers.length > 0, 'reports at least one blocker')
  const blocker = blocked.blockers[0]
  t.equal(blocker.comparator, '<3.0.0-0')
  t.same(blocker.tuple, [3, 0, 0], 'reports the tuple where it blocks')

  const eqConflict = minVersionExplain.explain('1.2.3 || >4 <3')
  t.equal(eqConflict.version.version, '1.2.3', 'still finds a satisfiable branch')
  t.end()
})

test('minVersion caches per range+options and exposes hits', (t) => {
  const minVersionCached = require('../../ranges/min-version')
  const { hits, misses } = minVersionCached.stats
  minVersionCached('~2.5.1')
  t.equal(minVersionCached.stats.misses, misses + 1, 'first call is a miss')
  minVersionCached('~2.5.1')
  t.equal(minVersionCached.stats.hits, hits + 1, 'repeat call is a hit')
  t.equal(minVersionCached.stats.misses, misses + 1, 'no extra miss')

  // different options must not share cache entries
  const a = minVersionCached('~1.2', { includePrerelease: true })
  const b = minVersionCached('~1.2')
  t.equal(a.version, '1.2.0-0')
  t.equal(b.version, '1.2.0')
  t.end()
})
