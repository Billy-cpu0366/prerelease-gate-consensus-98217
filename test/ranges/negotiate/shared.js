'use strict'

const t = require('tap')
const { negotiate } = require('../../..')
const { clearCache, cacheStats } = negotiate

// shared cache: resets are observable and start every accounting at zero
clearCache()
const start = cacheStats()
t.equal(start.hits, 0)
t.equal(start.misses, 0)
t.equal(start.size, 0)

negotiate.canonicalize('^1.0.0')
t.equal(cacheStats().misses, 1)
negotiate.canonicalize('^1.0.0')
t.equal(cacheStats().hits, 1)

clearCache()
t.equal(cacheStats().hits, 0)
t.equal(cacheStats().misses, 0)
