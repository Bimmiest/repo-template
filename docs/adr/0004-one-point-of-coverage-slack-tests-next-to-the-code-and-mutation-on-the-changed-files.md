# 0004. One point of coverage slack, tests next to the code, and mutation on the changed files

- **Status:** Accepted
- **Date:** 2026-11-11
- **Issue:** #49

## Context

`docs/testing.md` of the template and of propslab, its largest consumer,
gave different rules for three things (#49):

- **The slack of the coverage ratchet.** The template failed a run that is
  more than one point above the floor. propslab sets each floor one point
  under the measured figure, and runs the ratchet with `slack: 3`, so that
  the floors of its MCP server hold on its Windows and macOS legs.
- **Where the test files are.** The template put each test file next to the
  code that it tests. propslab puts its test files in `__tests__/`
  directories.
- **Mutation testing on a pull request.** The template said that mutation
  testing runs each week and does not block a pull request. propslab and
  pcre2-wasm-utf16 mutate the changed files of a pull request, and hold them
  to the floor, in a check that is not required.

Two constraints applied:

- GitHub stops a job after 6 hours. The full mutation run of propslab was one
  job, and it took 254 minutes on 2026-11-09 (Bimmiest/propslab#851). With
  static mutants, it needs 6 to 12 hours (Bimmiest/propslab#571).
- If a shared check fails on something that it passed before, that is a
  major version of shared-workflows.

## Decision

1. **The slack of the coverage ratchet is one point**, the default of
   `coverage-ratchet`. A repository that needs more slack records it as a
   deviation, with the reason.
2. **Each test file is next to the code that it tests.**
3. **Mutation testing:**
   - A full run each week, and on demand.
   - On a pull request, the run mutates the files in scope that the pull
     request changes, and the source files whose tests it changes. It holds
     these files to the floor. The check is not a required check.
   - Each job finishes well inside the time limit of one job on its runner.
     When the full run does not fit, divide the `mutate` list across the
     jobs of a matrix, and hold the combined score to the floor.

`docs/testing.md` gives the rules and the reasons.

## Consequences

- No shared check fails on something that it passed before, so no answer is
  a major version of shared-workflows. Bimmiest/shared-workflows#37 gets a
  mode for the changed files and a matrix for the full run, which are new
  inputs.
- propslab records three deviations: `slack: 3`, the `__tests__/`
  directories, and `ignoreStatic` for the job time limit. The deviations go
  below the `## In this repository` heading of #53, when propslab adopts it.
  propslab moves the engine tests next to the code in Bimmiest/propslab#773.
- With one point of slack, a job on a different platform that measures a
  lower figure can fail with no change to the code. A deviation is the
  remedy.
- A weakly tested change gets a red check on its own pull request, and it can
  still merge: the reviewer decides. A required check makes each merge wait
  for a slow run.
- A matrix repeats the setup of the run in each job.
- To change one of these rules, write a new ADR that supersedes this one.
