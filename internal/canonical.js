'use strict'

// Shared canonicalization helpers for range negotiation (normalize,
// intersection). A canonical comparator list is deduped by value, has
// ANY comparators dropped when real comparators exist, and is sorted
// deterministically so that semantically identical ranges always
// produce byte-identical output.

const Comparator = require('../classes/comparator')
const { ANY } = Comparator
const compare = require('../functions/compare')

const OPERATOR_RANK = { '': 0, '>=': 1, '>': 2, '<=': 3, '<': 4 }

const compareComparators = (a, b) => {
  if (a.semver === ANY || b.semver === ANY) {
    return a.semver === b.semver ? 0 : a.semver === ANY ? -1 : 1
  }
  const byVersion = compare(a.semver, b.semver)
  if (byVersion !== 0) {
    return byVersion
  }
  return OPERATOR_RANK[a.operator] - OPERATOR_RANK[b.operator]
}

const canonicalSet = (comparators) => {
  const seen = new Set()
  const deduped = []
  for (const c of comparators) {
    if (!seen.has(c.value)) {
      seen.add(c.value)
      deduped.push(c)
    }
  }
  const real = deduped.filter((c) => c.semver !== ANY)
  const usable = real.length ? real : deduped
  return usable.sort(compareComparators)
}

const formatSet = (comparators) => comparators.map((c) => c.value).join(' ')

const canonicalSets = (range) => range.set.map(canonicalSet)

const formatRange = (sets) => {
  const formatted = [...new Set(sets.map(formatSet))].sort()
  const out = formatted.join('||')
  return out === '' ? '*' : out
}

module.exports = {
  canonicalSet,
  canonicalSets,
  formatSet,
  formatRange,
}
