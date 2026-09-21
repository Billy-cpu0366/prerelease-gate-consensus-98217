'use strict'

const t = require('tap')
const { negotiate } = require('../../..')
const { intersect, canonicalize, isSubset, clearCache } = negotiate

t.beforeEach(() => clearCache())

t.equal(intersect(['^1.0.0', '>=1.2.0 <1.8.0']), '>=1.2.0 <1.8.0')
t.equal(intersect(['1.x', '1.2 - 1.4.x']), '>=1.2.0 <1.5.0-0')

// disjoint pairing yields an empty result, never a widened one
t.equal(intersect(['^1.0.0', '>=2.0.0']), null)
t.equal(intersect(['1.2.3', '1.2.4']), null)
t.equal(intersect(['<1.0.0', '>=1.0.0']), null)

// order independent
t.equal(
  intersect(['<1.8.0', '>=1.2.0', '^1.0.0']),
  intersect(['^1.0.0', '<1.8.0', '>=1.2.0'])
)

// self intersection is identity
t.equal(intersect(['^1.2.3', '^1.2.3']), canonicalize('^1.2.3'))

// n-ary
t.equal(intersect(['^1.0.0', '>=1.1.0', '<1.5.0']), '>=1.1.0 <1.5.0')

// exact pin collapses the conjunction
t.equal(intersect(['1.2.3', '>=1.0.0 <2.0.0']), '1.2.3')

// unions distribute pairwise
t.equal(
  intersect(['1.x || 2.x', '>=1.5.0 <2.5.0']),
  '>=1.5.0 <2.0.0-0||>=2.0.0 <2.5.0'
)

// prerelease admission survives the intersection and obeys the gate
const pre = intersect(['>=1.0.0-alpha', '<1.5.0'])
t.equal(pre, '>=1.0.0-alpha <1.5.0')
t.equal(negotiate.isPrereleaseAllowed(pre, '1.0.0-beta'), true)
t.equal(negotiate.isPrereleaseAllowed(pre, '1.5.0-alpha'), false)
t.equal(negotiate.isPrereleaseAllowed(pre, '1.2.0-alpha'), false)

// round-trip: intersection feeds back through canonicalize/intersect
const r = intersect(['^1.0.0', '~1.2 - 1.4.x'])
t.equal(canonicalize(r), r)
t.equal(intersect([r, r]), r)
t.equal(intersect([r, canonicalize(r)]), r)

// never wider than an operand
const a = '>=1.2.0 <1.8.0'
const b = '>=1.4.0 <1.6.0'
const ab = intersect([a, b])
t.equal(isSubset(ab, a), true)
t.equal(isSubset(ab, b), true)

// build metadata and bad inputs never break the chain
t.equal(
  intersect(['>=1.2.3+build <2.0.0', '^1.2.3']),
  intersect(['>=1.2.3 <2.0.0', '^1.2.3'])
)
t.equal(intersect(['^1.0.0', 'garbage']), null)

// many conditions terminate quickly instead of stalling
const many = []
for (let i = 0; i < 200; i++) {
  many.push(`>=1.${i}.0`)
  many.push(`<1.${i + 1}.0`)
}
t.equal(intersect(many), null)
