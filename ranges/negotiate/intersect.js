'use strict'

const Comparator = require('../../classes/comparator')
const {
  remember,
  toRange,
  canonicalComparators,
} = require('./shared')

// Merge two AND-ed comparator lists.
//
// Every pin must agree with every bound, opposite bounds must overlap,
// and the prerelease gate is exactly the one Range#test uses: a prerelease
// is admitted only when some comparator with the same [major, minor, patch]
// tuple carries a real prerelease (the desugared `<x.y.z-0` sentinel is
// only an exclusive upper bound, it admits nothing).
const intersectSimple = (a, b, options) => {
  const merged = mergeComparators([...a, ...b], options)
  if (!merged) {
    return null
  }
  return canonicalComparators(merged, options)
}

const tupleKey = (semver) =>
  `${semver.major}.${semver.minor}.${semver.patch}`

const isRealPrerelease = (semver, operator) => {
  if (!semver.prerelease.length) {
    return false
  }
  // `<x.y.z-0` is the standard desugaring for "everything before x.y.z",
  // not an explicit invitation to prereleases of that tuple.
  if (operator === '<' &&
      semver.prerelease.length === 1 &&
      semver.prerelease[0] === 0) {
    return false
  }
  return true
}

// Return the canonical comparator list, or null when the conjunction is
// contradictory (empty intersection, which must never widen back to `*`).
const mergeComparators = (comparators, options) => {
  const pins = new Map()
  const lowers = []
  const uppers = []

  for (const c0 of comparators) {
    const c = c0 instanceof Comparator ? c0 : new Comparator(c0, options)
    if (c.semver === Comparator.ANY) {
      continue
    }
    if (c.operator === '') {
      const key = c.semver.version
      const seen = pins.get(key)
      if (seen && seen.value !== c.value) {
        return null
      }
      pins.set(key, c)
    } else if (c.operator === '>' || c.operator === '>=') {
      lowers.push(c)
    } else if (c.operator === '<' || c.operator === '<=') {
      uppers.push(c)
    }
  }

  // two distinct exact pins can never share a version
  if (pins.size > 1) {
    return null
  }

  // strongest lower and upper bound
  const low = highestLower(lowers)
  const high = lowestUpper(uppers)

  if (low && high) {
    const cmp = low.semver.compare(high.semver)
    if (cmp > 0) {
      return null
    }
    if (cmp === 0 && (low.operator === '>' || high.operator === '<')) {
      return null
    }
  }

  // every pin has to satisfy the tightest bounds
  for (const pin of pins.values()) {
    if (low && !low.test(pin.semver)) {
      return null
    }
    if (high && !high.test(pin.semver)) {
      return null
    }
  }

  // An exact pin that agrees with the bounds is the whole conjunction:
  // only that one version passes, so bounds and prerelease carriers add
  // nothing to the intersection.
  if (pins.size === 1) {
    return [...pins.values()]
  }

  const result = []
  if (low) {
    result.push(low)
  }
  for (const pin of pins.values()) {
    result.push(pin)
  }
  if (high) {
    result.push(high)
  }

  // Prerelease admission carriers: keep an explicit comparator for every
  // tuple admitted by either operand that the tightest bounds do not
  // already cover.  This is what keeps the prerelease gate identical to
  // Range#test for the intersection.
  const admittedTuples = new Set()
  for (const c of comparators) {
    if (c.semver !== Comparator.ANY && isRealPrerelease(c.semver, c.operator)) {
      admittedTuples.add(tupleKey(c.semver))
    }
  }

  const covered = new Set()
  for (const c of result) {
    if (c.semver !== Comparator.ANY && isRealPrerelease(c.semver, c.operator)) {
      covered.add(tupleKey(c.semver))
    }
  }

  for (const c of comparators) {
    if (c.semver === Comparator.ANY || !isRealPrerelease(c.semver, c.operator)) {
      continue
    }
    const key = tupleKey(c.semver)
    if (covered.has(key) || !admittedTuples.has(key)) {
      continue
    }
    // only keep the carrier if its tuple actually lies inside the bounds
    if (low && !tupleSatisfies(c.semver, low)) {
      continue
    }
    if (high && !tupleSatisfies(c.semver, high)) {
      continue
    }
    // a carrier that is weaker than the tightest bound on the same side
    // cannot tighten anything, but it still admits the tuple prereleases
    result.push(c)
    covered.add(key)
  }

  if (!result.length) {
    return [new Comparator('', options)]
  }
  return result
}

const tupleSatisfies = (semver, bound) => bound.test(semver)

const highestLower = (lowers) => {
  let best = null
  for (const c of lowers) {
    if (!best) {
      best = c
      continue
    }
    const cmp = c.semver.compare(best.semver)
    if (cmp > 0) {
      best = c
    } else if (cmp === 0 && c.operator === '>' && best.operator === '>=') {
      best = c
    }
  }
  return best
}

const lowestUpper = (uppers) => {
  let best = null
  for (const c of uppers) {
    if (!best) {
      best = c
      continue
    }
    const cmp = c.semver.compare(best.semver)
    if (cmp < 0) {
      best = c
    } else if (cmp === 0 && c.operator === '<' && best.operator === '<=') {
      best = c
    }
  }
  return best
}

// Distribute one simple range over a union of simple ranges.
const distribute = (simple, sets, options) => {
  const out = []
  for (const other of sets) {
    const merged = intersectSimple(simple, other, options)
    if (merged) {
      out.push(merged)
    }
  }
  return out
}

const spell = (simple, options) =>
  canonicalComparators(simple, options).map((c) => c.value).join(' ') || '*'

// Intersect any number of ranges.  Order-independent, idempotent against
// self, never wider than an operand; a contradictory pairing contributes
// nothing instead of silently widening the answer.
const intersect = (ranges, options) => {
  let list
  if (Array.isArray(ranges)) {
    list = ranges
  } else {
    const args = [...arguments]
    list = args.slice()
    // trailing options object, if present
    if (list.length && typeof list[list.length - 1] === 'object' &&
        list[list.length - 1] !== null &&
        !list[list.length - 1].set) {
      options = list.pop()
    }
  }
  if (!list.length) {
    return null
  }
  const { value } = remember('intersect', list, options, () => {
    const parsed = []
    for (const r of list) {
      const rr = toRange(r, options)
      if (!rr) {
        return null
      }
      parsed.push(rr.set)
    }

    let acc = parsed[0]
    for (let i = 1; i < parsed.length; i++) {
      const next = parsed[i]
      const produced = []
      for (const simple of acc) {
        produced.push(...distribute(simple, next, options))
      }
      if (!produced.length) {
        return null
      }
      acc = produced
    }

    const spellings = acc
      .map((simple) => spell(simple, options))
      .filter((spelling) => spelling !== '<0.0.0-0')
    if (!spellings.length) {
      return null
    }
    return [...new Set(spellings.sort())].join('||')
  })
  return value
}

module.exports = intersect
