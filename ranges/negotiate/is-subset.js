'use strict'

const Comparator = require('../../classes/comparator')
const compare = require('../../functions/compare')
const { remember, toRange } = require('./shared')
const parseOptions = require('../../internal/parse-options')

// Strict containment check that agrees with the prerelease gate used by
// satisfies/intersect/minSatisfying: a range admitting prereleases of some
// tuple is only a subset if the container admits that same tuple too.

const tupleKey = (semver) =>
  `${semver.major}.${semver.minor}.${semver.patch}`

// `<x.y.z-0` is the desugared exclusive upper bound, not a prerelease
// admission for tuple x.y.z.
const carriesPrerelease = (comp) => {
  if (comp.semver === Comparator.ANY || !comp.semver.prerelease.length) {
    return false
  }
  if (comp.operator === '<' &&
      comp.semver.prerelease.length === 1 &&
      comp.semver.prerelease[0] === 0) {
    return false
  }
  return true
}

const strongerLower = (a, b) => {
  const cmp = compare(a.semver, b.semver)
  if (cmp !== 0) {
    return cmp > 0 ? a : b
  }
  // >x beats >=x
  if (a.operator === '>' && b.operator === '>=') {
    return a
  }
  if (b.operator === '>' && a.operator === '>=') {
    return b
  }
  return a
}

const strongerUpper = (a, b) => {
  const cmp = compare(a.semver, b.semver)
  if (cmp !== 0) {
    return cmp < 0 ? a : b
  }
  // <x beats <=x
  if (a.operator === '<' && b.operator === '<=') {
    return a
  }
  if (b.operator === '<' && a.operator === '<=') {
    return b
  }
  return a
}

const boundsOf = (simple) => {
  let low = null
  let high = null
  const eqs = []
  for (const c of simple) {
    if (c.semver === Comparator.ANY) {
      continue
    }
    if (c.operator === '') {
      eqs.push(c)
    } else if (c.operator === '>' || c.operator === '>=') {
      low = low ? strongerLower(low, c) : c
    } else {
      high = high ? strongerUpper(high, c) : c
    }
  }
  return { low, high, eqs }
}

const satisfiesBound = (semver, bound) => {
  const cmp = compare(semver, bound.semver)
  if (bound.operator === '>') {
    return cmp > 0
  }
  if (bound.operator === '>=') {
    return cmp >= 0
  }
  if (bound.operator === '<') {
    return cmp < 0
  }
  return cmp <= 0
}

const simpleSubset = (sub, dom, options) => {
  const s = boundsOf(sub)
  const d = boundsOf(dom)

  // contradictory simple range (null set): subset of everything
  if (s.eqs.length > 1) {
    return true
  }
  if (s.low && s.high) {
    const cmp = compare(s.low.semver, s.high.semver)
    if (cmp > 0 ||
        (cmp === 0 && (s.low.operator === '>' || s.high.operator === '<'))) {
      return true
    }
  }

  const includePre = !!options.includePrerelease

  // Pin containment (checked before the generic tuple/bound logic).
  if (s.eqs.length === 1) {
    const pin = s.eqs[0].semver
    for (const c of dom) {
      if (c.semver === Comparator.ANY) {
        continue
      }
      if (!c.test(pin)) {
        return false
      }
    }
    if (!includePre && pin.prerelease.length) {
      let admitted = false
      for (const c of dom) {
        if (carriesPrerelease(c) && tupleKey(c.semver) === tupleKey(pin)) {
          admitted = true
          break
        }
      }
      if (!admitted) {
        return false
      }
    }
    return true
  }

  // Prerelease tuples admitted by the sub bounds must be admitted by dom too.
  if (!includePre) {
    const subTuples = new Set()
    if (s.low && carriesPrerelease(s.low)) {
      subTuples.add(tupleKey(s.low.semver))
    }
    if (s.high && carriesPrerelease(s.high)) {
      subTuples.add(tupleKey(s.high.semver))
    }
    for (const key of subTuples) {
      if (!domAdmitsTuple(dom, d, key, s.low, s.high)) {
        return false
      }
    }
  }

  // Bound containment: sub's strongest lower bound must not be below dom's,
  // and must itself pass dom's lower bound; symmetric for the upper side.
  if (s.low && d.low) {
    const cmp = compare(s.low.semver, d.low.semver)
    if (cmp < 0) {
      return false
    }
    if (cmp === 0) {
      // >=x is not inside >x
      if (d.low.operator === '>' && s.low.operator === '>=') {
        return false
      }
    } else if (!satisfiesBound(s.low.semver, d.low)) {
      return false
    }
  } else if (!s.low && d.low) {
    // sub extends lower than dom
    return false
  }

  if (s.high && d.high) {
    const cmp = compare(s.high.semver, d.high.semver)
    if (cmp > 0) {
      return false
    }
    if (cmp === 0) {
      // <=x is not inside <x
      if (d.high.operator === '<' && s.high.operator === '<=') {
        return false
      }
    } else if (!satisfiesBound(s.high.semver, d.high)) {
      return false
    }
  } else if (!s.high && d.high) {
    // sub extends higher than dom
    return false
  }

  // dom has no lower/upper bound on that side => sub is bounded by nothing
  // extra, which is fine.
  return true
}

// Does the dom simple range admit prereleases of tuple `major.minor.patch`?
// Either a dom comparator explicitly carries that tuple, or includePrerelease
// mode is in effect, or the tuple is outside dom's bounds entirely (then the
// matter is moot and containment does not require an admission carrier).
const domAdmitsTuple = (dom, d, key, subLow, subHigh) => {
  for (const c of dom) {
    if (!carriesPrerelease(c) &&
        !(c.operator === '' && c.semver.prerelease.length)) {
      continue
    }
    if (tupleKey(c.semver) !== key) {
      continue
    }
    if (c.operator === '') {
      return true
    }
    // a lower carrier admits prereleases of this tuple at or above the
    // carrier version; a stronger sub lower bound on the same tuple is
    // still inside that admission.
    if ((c.operator === '>' || c.operator === '>=') && subLow &&
        tupleKey(subLow.semver) === key &&
        compare(subLow.semver, c.semver) >= 0) {
      return true
    }
    if ((c.operator === '<' || c.operator === '<=') && subHigh &&
        tupleKey(subHigh.semver) === key) {
      // sub's upper boundary is at or below the carrier's boundary on the
      // same admitted tuple
      if (compare(subHigh.semver, c.semver) <= 0) {
        return true
      }
    }
  }
  return false
}

// Is every version admitted by `sub` also admitted by `dom`?
// Each OR arm of sub must be a null set or fall inside some arm of dom.
const isSubset = (sub, dom, options) => {
  if (sub === dom) {
    return true
  }
  options = parseOptions(options)
  const subRange = toRange(sub, options)
  const domRange = toRange(dom, options)
  if (!subRange || !domRange) {
    return false
  }
  return remember('subset',
    [subRange.range || String(sub), domRange.range || String(dom)],
    options, () => {
      for (const simpleSub of subRange.set) {
        if (boundsOf(simpleSub).eqs.length > 1) {
          continue // null set
        }
        let covered = false
        for (const simpleDom of domRange.set) {
          if (simpleSubset(simpleSub, simpleDom, options)) {
            covered = true
            break
          }
        }
        if (!covered) {
          return false
        }
      }
      return true
    }).value
}

module.exports = isSubset
