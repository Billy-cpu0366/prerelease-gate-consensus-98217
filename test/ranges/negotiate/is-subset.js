'use strict'

const t = require('tap')
const { negotiate } = require('../../..')
const { isSubset, clearCache } = negotiate

t.beforeEach(() => clearCache())

t.equal(isSubset('^1.2.3', '>=1.0.0 <2.0.0'), true)
t.equal(isSubset('>=1.0.0 <2.0.0', '>=1.0.0 <2.0.0'), true)
t.equal(isSubset('^1.2.3', '^1.3.0'), false)

// boundary equality counts as contained
t.equal(isSubset('>=1.2.0', '>=1.2.0'), true)
t.equal(isSubset('>1.2.0', '>=1.2.0'), true)
t.equal(isSubset('>=1.2.0', '>1.2.0'), false)

// prerelease-bearing ranges are not subsets of non-admitting ranges
t.equal(isSubset('>=1.2.3-alpha <2.0.0', '^1.2.3'), false)
t.equal(isSubset('1.2.3-beta', '^1.2.3-alpha'), true)
t.equal(isSubset('1.2.4-alpha', '^1.2.3-alpha'), false)
t.equal(isSubset('>=1.2.3-beta <2.0.0-0', '^1.2.3-alpha'), true)
t.equal(isSubset('>=1.2.3-alpha <2.0.0-0', '^1.2.3-beta'), false)
t.equal(isSubset('1.2.3-alpha.0', '>=1.2.3-alpha.1 <2.0.0'), false)
t.equal(isSubset('>=1.0.0 <2.0.0-beta', '<2.0.0-alpha'), false)
t.equal(isSubset('>=1.0.0 <2.0.0-alpha', '<2.0.0-beta'), true)

// unions: each arm must be covered
t.equal(isSubset('1.x || 2.x', '>=1.0.0 <3.0.0-0'), true)
t.equal(isSubset('1.x || 3.x', '>=1.0.0 <3.0.0-0'), false)

t.equal(isSubset('garbage', '^1.0.0'), false)
t.equal(isSubset('^1.0.0', 'garbage'), false)
