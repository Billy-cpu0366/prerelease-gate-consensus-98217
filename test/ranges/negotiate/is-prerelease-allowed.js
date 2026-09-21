'use strict'

const t = require('tap')
const { negotiate } = require('../../..')
const { isPrereleaseAllowed, clearCache } = negotiate

t.beforeEach(() => clearCache())

t.equal(isPrereleaseAllowed('^1.2.3-alpha.1', '1.2.3-beta.2'), true)
t.equal(isPrereleaseAllowed('^1.2.3-alpha.1', '1.2.3-alpha.0'), false)
// a higher tuple's prerelease is always blocked
t.equal(isPrereleaseAllowed('^1.2.3-alpha.1', '1.2.4-alpha'), false)
t.equal(isPrereleaseAllowed('^1.2.3-alpha.1', '2.0.0-alpha'), false)
t.equal(isPrereleaseAllowed('>=1.0.0 <2.0.0', '1.5.0-rc'), false)
t.equal(isPrereleaseAllowed('>=1.0.0-alpha <2.0.0', '1.0.0-rc'), true)
t.equal(isPrereleaseAllowed('>=1.0.0-alpha <2.0.0', '1.9.0-rc'), false)
// union arms carry their own tuples
t.equal(
  isPrereleaseAllowed('>=1.2.3-alpha || >=2.0.0-beta', '2.0.0-rc'),
  true
)
t.equal(
  isPrereleaseAllowed('>=1.2.3-alpha || >=2.0.0-beta', '1.9.0-rc'),
  false
)
t.equal(isPrereleaseAllowed('garbage', '1.2.3-alpha'), false)
