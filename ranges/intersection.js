'use strict'

// Compute the intersection of two or more ranges.
//
// Accepts any number of ranges (plus an optional trailing options
// object) and returns a Range covering exactly the versions allowed by
// every input. Unions are distributed pairwise; any pair of simple
// ranges that cannot meet produces no output branch. If nothing
// survives, the result is null (the empty set) and is never silently
// widened into something satisfiable. Input order does not affect the
// result, intersecting a range with itself returns the same range, and
// the result only ever narrows. The returned Range is canonical, so it
// can be fed back through normalize() unchanged.
//
// Prerelease gating follows the same rule as satisfies()/subset():
// a prerelease is only allowed when a comparator with the same
// [major, minor, patch] tuple explicitly mentions a prerelease.

const Range = require('../classes/range')
const Comparator = require('../classes/comparator')
const { ANY } = Comparator
const compare = require('../functions/compare')
const parseOptions = require('../internal/parse-options')
const { canonicalSet, canonicalSets, formatRange } = require('../internal/canonical')

const NULL_SET = '<0.0.0-0'

// >=1.2.3 is lower than >1.2.3
const higherGT = (a, b) => {
  const comp = compare(a.semver, b.semver)
  return comp > 0 ? a
    : comp < 0 ? b
    : b.operator === '>' && a.operator === '>=' ? b
    : a
}

// <=1.2.3 is higher than <1.2.3
const lowerLT = (a, b) => {
  const comp = compare(a.semver, b.semver)
  return comp < 0 ? a
    : comp > 0 ? b
    : b.operator === '<' && a.operator === '<=' ? b
    : a
}

// determine whether a conjunction of comparators cannot be satisfied
const isEmptySet = (comparators) => {
  let eq = null
  let gt = null
  let lt = null
  for (const c of comparators) {
    if (c.semver === ANY) {
      continue
    }
    if (c.value === NULL_SET) {
      return true
    }
    switch (c.operator) {
      case '':
        if (eq && compare(eq.semver, c.semver) !== 0) {
          return true
        }
        eq = eq || c
        break
      case '>':
      case '>=':
        gt = gt ? higherGT(gt, c) : c
        break
      case '<':
      case '<=':
        lt = lt ? lowerLT(lt, c) : c
        break
    }
  }

  if (eq) {
    for (const c of comparators) {
      if (c === eq || c.semver === ANY) {
        continue
      }
      if (!c.test(eq.semver)) {
        return true
      }
    }
    return false
  }

  if (gt && lt) {
    const comp = compare(gt.semver, lt.semver)
    if (comp > 0) {
      return true
    }
    if (comp === 0 && (gt.operator !== '>=' || lt.operator !== '<=')) {
      return true
    }
  }

  return false
}

// the [major, minor, patch] tuples a comparator list explicitly
// admits prereleases for
const prereleaseTuples = (comparators) => {
  const tuples = new Set()
  for (const c of comparators) {
    if (c.semver !== ANY && c.semver.prerelease.length) {
      tuples.add(c.semver.version.split('-')[0])
    }
  }
  return tuples
}

// A prerelease is only allowed through an intersection when every
// side explicitly admits that [major, minor, patch] tuple. Comparators
// carrying a prerelease for a tuple that did not survive the merge are
// rewritten to the equivalent bound on the release version, which
// admits exactly the same non-prerelease versions without leaking the
// tuple's prereleases through the merged range's gating.
const sanitizeComparator = (comparator, options) => {
  const version = comparator.semver.version.split('-')[0]
  switch (comparator.operator) {
    case '':
      // =1.2.3-alpha admits nothing once the tuple is gated out
      return null
    case '<':
    case '<=':
      return new Comparator(`<${version}`, options)
    case '>':
    case '>=':
      return new Comparator(`>=${version}`, options)
  }
  /* istanbul ignore next */
  return null
}

const sanitizeSet = (comparators, tuples, options) => {
  const out = []
  for (const c of comparators) {
    if (c.semver === ANY || !c.semver.prerelease.length) {
      out.push(c)
      continue
    }
    const tuple = c.semver.version.split('-')[0]
    if (tuples.has(tuple)) {
      out.push(c)
      continue
    }
    const sanitized = sanitizeComparator(c, options)
    if (sanitized === null || sanitized.value === '<0.0.0') {
      // the branch cannot admit anything once this comparator is gated
      return null
    }
    out.push(sanitized)
  }
  return out
}

const isOptions = (arg) =>
  typeof arg === 'object' &&
  arg !== null &&
  !(arg instanceof Range) &&
  !(arg instanceof Comparator)

const intersection = (...args) => {
  let options
  if (args.length && isOptions(args[args.length - 1])) {
    options = args.pop()
  }
  if (!args.length) {
    return null
  }

  let ranges
  try {
    ranges = args.map((r) => new Range(r, options))
  } catch (er) {
    return null
  }
  const opts = parseOptions(options)

  let acc = canonicalSets(ranges[0]).map((comps) => ({
    comps,
    tuples: prereleaseTuples(comps),
  }))
  for (let i = 1; i < ranges.length && acc.length; i++) {
    const next = canonicalSets(ranges[i]).map((comps) => ({
      comps,
      tuples: prereleaseTuples(comps),
    }))
    const merged = []
    for (const a of acc) {
      for (const b of next) {
        const tuples = new Set()
        for (const tuple of a.tuples) {
          if (b.tuples.has(tuple)) {
            tuples.add(tuple)
          }
        }
        let comps = canonicalSet([...a.comps, ...b.comps])
        if (!opts.includePrerelease) {
          comps = sanitizeSet(comps, tuples, opts)
          if (comps === null) {
            continue
          }
          comps = canonicalSet(comps)
        }
        if (!isEmptySet(comps)) {
          merged.push({ comps, tuples })
        }
      }
    }
    const seen = new Set()
    acc = merged.filter(({ comps }) => {
      const key = comps.map((c) => c.value).join(' ')
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  if (!acc.length) {
    return null
  }

  return new Range(formatRange(acc.map(({ comps }) => comps)), options)
}

module.exports = intersection
