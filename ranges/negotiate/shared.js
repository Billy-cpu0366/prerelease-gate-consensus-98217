'use strict'

const Range = require('../../classes/range')
const Comparator = require('../../classes/comparator')
const LRU = require('../../internal/lrucache')
const parseOptions = require('../../internal/parse-options')

// One shared cache for every entry point of the negotiation layer.
// Same range + same options must always land in the same cache slot,
// different options (loose, includePrerelease, includeBuild) never share one.
const cache = new LRU()

// How many times a slot was produced fresh vs. served from the cache.
const stats = { hits: 0, misses: 0 }

const flags = (options) => {
  const o = parseOptions(options)
  let f = 0
  if (o.loose) {
    f |= 1
  }
  if (o.includePrerelease) {
    f |= 2
  }
  if (o.includeBuild) {
    f |= 4
  }
  return { options: o, flags: f }
}

const keyFor = (kind, options, parts) =>
  kind + '|' + flags(options).flags + '|' + parts.map((p) => String(p)).join('||')

const remember = (kind, parts, options, produce) => {
  const key = keyFor(kind, options, parts)
  const cached = cache.get(key)
  if (cached !== undefined) {
    stats.hits++
    return { value: cached, cached: true }
  }
  stats.misses++
  const value = produce()
  cache.set(key, value)
  return { value, cached: false }
}

// Build a Range without ever throwing.  Garbage input becomes null,
// so one bad range can never take the whole chain down.
const toRange = (range, options) => {
  if (range === null || range === undefined) {
    return null
  }
  try {
    return new Range(range, options)
  } catch {
    return null
  }
}

// Operator ordering inside one simple range:
// lower bounds, then pins, then upper bounds, then the unbounded ANY.
const operatorRank = (op) => {
  switch (op) {
    case '>': return 0
    case '>=': return 1
    case '': return 2
    case '<=': return 3
    case '<': return 4
    default: return 5
  }
}

const compareComparatorStrings = (a, b) => {
  const ra = operatorRank(a.operator)
  const rb = operatorRank(b.operator)
  if (ra !== rb) {
    return ra - rb
  }
  if (a.semver === Comparator.ANY || b.semver === Comparator.ANY) {
    return 0
  }
  const cmp = a.semver.compare(b.semver)
  if (cmp !== 0) {
    return cmp
  }
  return a.value < b.value ? -1 : a.value > b.value ? 1 : 0
}

// Canonical spelling of one AND-ed set of comparators.
const canonicalComparators = (comparators, options) => {
  const byValue = new Map()
  for (const c of comparators) {
    const comp = c instanceof Comparator ? c : new Comparator(c, options)
    byValue.set(comp.value, comp)
  }
  let comps = [...byValue.values()]

  // A single ANY comparator swallows every other comparator.
  if (comps.some((c) => c.semver === Comparator.ANY)) {
    comps = comps.filter((c) => c.semver === Comparator.ANY)
  }

  comps.sort(compareComparatorStrings)
  return comps
}

// Canonical spelling of a whole (possibly OR-joined) range.
// `null` means the input did not parse to any range.
const canonicalRange = (range, options) => {
  const r = toRange(range, options)
  if (!r) {
    return null
  }
  const sets = r.set
    .map((set) => {
      const comps = canonicalComparators(set, options)
      const spelling = comps.map((c) => c.value).join(' ')
      // the single ANY comparator is the canonical "every version" arm
      return spelling === '' ? '*' : spelling
    })
  if (!sets.length) {
    return null
  }
  sets.sort()
  // de-duplicate equivalent arms after sorting
  const unique = [...new Set(sets)]
  return unique.join('||')
}

module.exports = {
  cache,
  stats,
  flags,
  remember,
  toRange,
  canonicalRange,
  canonicalComparators,
  compareComparatorStrings,
}
