'use strict'

// Version range negotiation layer.
//
// Every dependency version reconciliation goes through these five entry
// points so that the whole chain shares one interpretation of ranges:
//
//   canonicalize  - one canonical spelling for every accepted notation
//   isPrereleaseAllowed - the single prerelease gate used everywhere
//   intersect     - intersection of any number of ranges
//   isSubset      - whole-range containment
//   minSatisfying - smallest passing version, with blocker diagnostics
//
// All of them fail soft on malformed input and share one option-aware cache.

const canonicalize = require('./canonicalize')
const intersect = require('./intersect')
const isSubset = require('./is-subset')
const minSatisfying = require('./min-satisfying')
const isPrereleaseAllowed = require('./is-prerelease-allowed')
const { cache, stats, canonicalRange } = require('./shared')

const cacheStats = () => ({ ...stats, size: cache.map.size })
const clearCache = () => {
  cache.map.clear()
  stats.hits = 0
  stats.misses = 0
}

module.exports = {
  canonicalize,
  intersect,
  isSubset,
  minSatisfying,
  isPrereleaseAllowed,
  canonicalRange,
  cacheStats,
  clearCache,
}
