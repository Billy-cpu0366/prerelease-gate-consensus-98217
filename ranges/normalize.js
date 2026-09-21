'use strict'

// Canonicalize a range into a single deterministic form.
//
// Union, hyphen, wildcard, tilde, and caret spellings of the same
// constraint all collapse to the same output. Build metadata does not
// participate in comparison and is stripped. Invalid input returns
// null instead of throwing, so a bad range cannot take down the whole
// negotiation chain. Normalizing is idempotent: normalize(normalize(x))
// === normalize(x).

const Range = require('../classes/range')
const { canonicalSets, formatRange } = require('../internal/canonical')

const normalize = (range, options) => {
  try {
    return formatRange(canonicalSets(new Range(range, options)))
  } catch (er) {
    return null
  }
}

module.exports = normalize
