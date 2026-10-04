# 0001. Conventions come from the template and the shared workflows

- **Status:** Accepted
- **Date:** 2026-10-04
- **Issue:** none; recorded when the repository was created

## Context

Every repository before this one derived its working conventions on its own. `propslab` and `propslab-ent` each grew a CONTRIBUTING, a CI, and a set of gate scripts, and the two drifted: the same coverage ratchet existed twice with different slack, one repository enforced its branch pattern and the other only described it, and a lesson learned in one (an allowlist whose plural form the scanner silently ignored, a `typecheck` that was two commands) had to be re-learned in the other.

[`repo-template`](https://github.com/Bimmiest/repo-template) distils what the two agreed on. [`shared-workflows`](https://github.com/Bimmiest/shared-workflows) holds the checks they ran, as reusable workflows and composite actions that a repository pins by commit.

## Decision

This repository starts from `repo-template` and runs the gates in `shared-workflows`, pinned by commit sha with the version in a comment, bumped by Dependabot.

A change to a shared gate is made in `shared-workflows` and arrives here as a pin bump. A convention this repository needs that the template lacks is added to the template first when a second repository would want it, and here alone otherwise. The sanctioned local knobs are the actions' inputs and the files they read: `.audit-exceptions.json`, `.licence-allowlist.json`, `.gitleaks.toml`, `.trivyignore.yaml`, `.docs-check.json`.

## Consequences

- One place to fix a gate; every consumer gets the fix on its next bump. A gate that newly fails on something it passed before is a major version of `shared-workflows`, so the bump is read rather than waved through.
- The cost is that a convention change is two pull requests, there and then here, and this repository cannot relax a shared check except through its inputs. That is the point: the convention is the same in every repository, and a repository that disagrees argues it where everyone will see.
- What to check when changing it: if this repository stops consuming `shared-workflows`, the scripts come here with their tests, CI runs them from `scripts/`, and this record is superseded.
