'use strict'

const t = require('tap')
const { negotiate } = require('../../..')
const { canonicalize, clearCache } = negotiate

t.beforeEach(() => clearCache())

t.equal(canonicalize('^1.2.3'), canonicalize('>=1.2.3 <2.0.0-0'))
t.equal(canonicalize('~1.2'), canonicalize('>=1.2.0 <1.3.0-0'))
t.equal(canonicalize('1.x'), canonicalize('>=1.0.0 <2.0.0-0'))
t.equal(canonicalize('1.2.3 - 2.3.4'), '>=1.2.3 <=2.3.4')
t.equal(canonicalize('1.2 - 2.3'), '>=1.2.0 <2.4.0-0')
t.equal(canonicalize('*'), '*')
t.equal(canonicalize(''), '*')

// build metadata never participates
t.equal(
  canonicalize('>=1.2.3+sha.abc <2.0.0'),
  canonicalize('>=1.2.3 <2.0.0')
)

// idempotent fixed point, even for unions
const once = canonicalize('~1.2 - 1.4.x || 1.x || ^2.0.0')
t.equal(canonicalize(once), once)

// one range against itself has one answer
t.equal(
  canonicalize('>=1.0.0 <2.0.0 || >=3.0.0'),
  canonicalize('>=1.0.0 <2.0.0 || >=3.0.0')
)

// broken input is "no result", never a throw
t.equal(canonicalize('not a range'), null)
t.equal(canonicalize('1.2.3.4'), null)
t.equal(canonicalize(null), null)
t.equal(canonicalize(undefined), null)
