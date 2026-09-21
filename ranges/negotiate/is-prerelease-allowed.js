'use strict'

const SemVer = require('../../classes/semver')
const { toRange } = require('./shared')

// The single prerelease gate shared by canonicalize/intersect/isSubset/
// minSatisfying: a prerelease version passes only when the range explicitly
// admits that exact [major, minor, patch] tuple (or includePrerelease is
// set).  A higher tuple's prerelease is always blocked, and build metadata
// never participates.
const isPrereleaseAllowed = (range, version, options) => {
  const r = toRange(range, options)
  if (!r) {
    return false
  }
  let semver = version
  if (typeof version === 'string') {
    try {
      semver = new SemVer(version, options)
    } catch {
      return false
    }
  }
  if (!semver) {
    return false
  }
  // Range#test already implements the tuple-scoped prerelease rule used by
  // satisfies, so the gate can never diverge from the rest of the layer.
  return r.test(semver)
}

module.exports = isPrereleaseAllowed
