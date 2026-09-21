'use strict'

const {
  remember,
  canonicalRange,
} = require('./shared')

// Normalise every accepted spelling (unions, hyphen ranges, wildcards,
// tildes, carets) to one canonical spelling.
// Bad input yields null instead of throwing, and the result is idempotent.
const canonicalize = (range, options) => {
  if (typeof range !== 'string' && !(range && range.set)) {
    return null
  }
  return remember('canonical', [String(range && range.raw !== undefined ? range.raw : range)],
    options, () => canonicalRange(range, options)).value
}

module.exports = canonicalize
