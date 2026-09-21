'use strict'

const SemVer = require('../../classes/semver')
const Comparator = require('../../classes/comparator')
const { remember, toRange } = require('./shared')

const compareLoose = require('../../functions/compare-loose')

// Which tuple segment blocked this candidate?
// Locate the comparator that keeps `candidate` out, down to the tuple
// segment that disagrees.  `ANY` comparators never block anything.
const explainBlock = (range, version) => {
  let blocker = null

  for (const set of range.set) {
    const failed = []
    let setMatches = true
    for (const comp of set) {
      if (comp.semver === Comparator.ANY) {
        continue
      }
      if (!comp.test(version)) {
        failed.push(comp)
        setMatches = false
      }
    }
    if (setMatches) {
      // an OR arm accepted, nothing blocks here
      return null
    }
    if (!blocker || failed.length < blocker.failed.length) {
      blocker = { failed }
    }
  }

  if (!blocker) {
    return null
  }

  const comp = blocker.failed[0]
  const target = comp.semver

  // Report the tuple segment of the blocking boundary.  When the candidate
  // differs only in a deeper segment, the blocking segment is that deeper
  // one (eg >=2.0.0 blocking 1.9.7 blocks at major; >=1.2.0 blocking
  // 1.1.9 blocks at minor).
  let segment
  if (version.major !== target.major) {
    segment = 'major'
  } else if (version.minor !== target.minor) {
    segment = 'minor'
  } else {
    segment = 'patch'
  }

  return {
    comparator: comp.value,
    operator: comp.operator,
    segment,
    version: target.version,
  }
}

// Candidate for one simple range: the smallest version its lower bounds and
// pins could possibly admit.  Mirrors ranges/min-version.js but reports the
// comparator that produced it.
const candidateFor = (comparators, options) => {
  let candidate = null
  let source = null

  const consider = (semver, comp) => {
    if (!candidate || compareLoose(semver, candidate, options) > 0) {
      candidate = semver
      source = comp
    }
  }

  for (const comp of comparators) {
    if (comp.semver === Comparator.ANY) {
      continue
    }
    const v = new SemVer(comp.semver.version, options)
    if (comp.operator === '>') {
      if (v.prerelease.length === 0) {
        v.patch++
        v.format()
        v.raw = v.version
      } else {
        v.prerelease.push(0)
        v.raw = v.format()
      }
      consider(v, comp)
    } else if (comp.operator === '>=' || comp.operator === '') {
      consider(v, comp)
    }
  }

  return { candidate, source }
}

// Minimum satisfying version for one range, using the same gate as
// satisfies/subset/intersect (Range#test).  When nothing satisfies it,
// the blocker points at the comparator and tuple segment responsible.
const minSatisfying = (range, options) => {
  const parsed = toRange(range, options)
  if (!parsed) {
    return {
      version: null,
      satisfies: false,
      cached: false,
      reason: 'invalid-range',
      blocker: null,
    }
  }

  const { value, cached } = remember('minsatisfying', [String(range)], options,
    () => {
      let best = null

      for (const set of parsed.set) {
        const { candidate } = candidateFor(set, options)
        const v = candidate || new SemVer('0.0.0', options)
        if (parsed.test(v) && (!best || compareLoose(v, best, options) < 0)) {
          best = v
        }
      }

      if (best) {
        return {
          version: best.version,
          satisfies: true,
          blocker: null,
        }
      }

      // nothing passes.  explain the block using the smallest candidate the
      // lower bounds asked for (or zero if the range has no lower bound).
      const probe = parsed.set
        .map((set) => candidateFor(set, options).candidate)
        .filter(Boolean)
        .sort((a, b) => compareLoose(a, b, options))[0] ||
        new SemVer('0.0.0', options)

      return {
        version: null,
        satisfies: false,
        blocker: explainBlock(parsed, probe),
      }
    })

  return { ...value, cached }
}

module.exports = minSatisfying
