'use strict'

const t = require('tap')
const negotiate = require('../../../ranges/negotiate')

// the negotiation layer is one account: all five entries are present
t.match(Object.keys(negotiate).sort(), [
  'cacheStats',
  'canonicalRange',
  'canonicalize',
  'clearCache',
  'intersect',
  'isPrereleaseAllowed',
  'isSubset',
  'minSatisfying',
])

// every entry shares the same canonical gate semantics
t.equal(
  negotiate.isPrereleaseAllowed(negotiate.canonicalize('^1.2.3-alpha'),
    '1.2.3-beta'),
  true
)
t.equal(
  negotiate.isPrereleaseAllowed(negotiate.canonicalize('^1.2.3-alpha'),
    '1.2.4-alpha'),
  false
)
