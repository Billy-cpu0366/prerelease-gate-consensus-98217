'use strict'

const SemVer = require('../classes/semver')
const Range = require('../classes/range')
const Comparator = require('../classes/comparator')
const { ANY } = Comparator
const gt = require('../functions/gt')
const LRU = require('../internal/lrucache')
const parseOptions = require('../internal/parse-options')

// Results are cached per (range, options) pair so repeated negotiation
// rounds with the same inputs do not recompute. Different option sets
// use different cache keys and never share entries. Cache hits and
// misses are observable via minVersion.stats.
const cache = new LRU()
const stats = { hits: 0, misses: 0 }

const computeMinVersion = (range, options) => {
  range = new Range(range, options)

  let minver = new SemVer('0.0.0')
  if (range.test(minver)) {
    return { version: minver, blockers: [] }
  }

  minver = new SemVer('0.0.0-0')
  if (range.test(minver)) {
    return { version: minver, blockers: [] }
  }

  minver = null
  const blockers = []
  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i]

    let setMin = null
    comparators.forEach((comparator) => {
      // Clone to avoid manipulating the comparator's semver object.
      const compver = new SemVer(comparator.semver.version)
      switch (comparator.operator) {
        case '>':
          if (compver.prerelease.length === 0) {
            compver.patch++
          } else {
            compver.prerelease.push(0)
          }
          compver.raw = compver.format()
          /* fallthrough */
        case '':
        case '>=':
          if (!setMin || gt(compver, setMin)) {
            setMin = compver
          }
          break
        case '<':
        case '<=':
          /* Ignore maximum versions */
          break
        /* istanbul ignore next */
        default:
          throw new Error(`Unexpected operation: ${comparator.operator}`)
      }
    })
    if (setMin && (!minver || gt(minver, setMin))) {
      minver = setMin
    }

    // Record exactly which comparator blocks this branch, and at
    // which [major, minor, patch] tuple, so callers can see why no
    // version gets through instead of just being told "no".
    const setString = comparators.map((c) => c.value).join(' ')
    for (const comparator of comparators) {
      if (comparator.semver === ANY) {
        continue
      }
      if (setMin && !comparator.test(setMin)) {
        blockers.push({
          set: setString,
          comparator: comparator.value,
          tuple: [
            comparator.semver.major,
            comparator.semver.minor,
            comparator.semver.patch,
          ],
          candidate: setMin.version,
        })
      }
    }
    if (!setMin) {
      blockers.push({
        set: setString,
        comparator: comparators[0] ? comparators[0].value : '',
        tuple: null,
        candidate: null,
      })
    }
  }

  if (minver && range.test(minver)) {
    return { version: minver, blockers: [] }
  }

  return { version: null, blockers }
}

const cacheKey = (range, options) =>
  `${String(range)}::${!!options.loose}::${!!options.includePrerelease}`

const negotiate = (range, options) => {
  const opts = parseOptions(options)
  const key = cacheKey(range, opts)
  const hit = cache.get(key)
  if (hit !== undefined) {
    stats.hits++
    return hit
  }
  stats.misses++
  const result = computeMinVersion(range, opts)
  cache.set(key, result)
  return result
}

const minVersion = (range, options) => negotiate(range, options).version

// minVersion.explain(range, options) returns
// { version: SemVer|null, blockers: [{ set, comparator, tuple, candidate }] }
// When no version can satisfy the range, blockers identifies the
// comparators that cut off every candidate, and the tuple at which
// they cut.
minVersion.explain = (range, options) => negotiate(range, options)
minVersion.cache = cache
minVersion.stats = stats

module.exports = minVersion
