# 0008. The estate accepts the MPL-2.0 licence

- **Status:** Accepted
- **Date:** 2026-11-25
- **Issue:** apps/foghorn#56

## Context

`.licence-allowlist.json` has a list of licences that are accepted for each
dependency. The list had no `MPL-2.0`. A package under this licence needed an
entry in `packages`, with the version that a person read.

foghorn found the gap when it checked the build tools too. Its web build
bundles the development dependencies, but the licence check reads only what
`npm ci --omit=dev` installs. With `include-dev: 'true'`, the check refused
`lightningcss` 1.33.0 and its 12 platform packages. All 13 are `MPL-2.0`.
`lightningcss` is a build tool of Vite, and its code is not in the build
output.

## Decision

`MPL-2.0` is in `licences` of `.licence-allowlist.json` in each repo, after
the licences that were there before.

The copyleft of MPL-2.0 is per file. It obliges only a person who changes an
MPL-2.0 file to keep that changed file open. A package that is used without a
change, such as a build tool or a library, does not change the licence of the
repository that uses it. A package that is under MPL-2.0 on one of its
branches, as an `OR` expression, already passed before this decision.

The estate does not add 13 package entries. They would need a new reading for
each new version of a platform package.

## Consequences

- A new dependency under `MPL-2.0` passes the check, with no reading.
- A person who changes the files of an MPL-2.0 package, for example with a
  patch or a fork, must keep those files open under MPL-2.0. The check cannot
  see this. Do not patch such a package inside a repo without a decision.
- A licence other than `MPL-2.0` is not accepted by this decision. It still
  needs an entry in `packages`.
