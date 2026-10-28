---
type: reference
---

# Tests

The rules for tests, and their reasons. CONTRIBUTING.md has the summary.

- Use Vitest, with the `node` environment, and put each `*.test.ts` file
  next to the code that it tests. A test that needs a DOM selects it in its
  own file.
- **The coverage floor is a ratchet, in both directions.** `vitest.config.ts`
  fails a run that is below the floor. CI's coverage ratchet fails a run that
  is more than one point above the floor, and prints the thresholds to
  write. Raise a floor in the change that raises the coverage. Do not lower
  a floor to make a branch green. Do not exclude code to make the numbers
  look better. Each exclusion has its reason next to it.
- **Lint checks what makes a test a test.** These fail lint: a case with no
  assertion, two cases with one name, and an `expect` that is not finished
  or not awaited. Give a helper that asserts for the test a name
  that starts with `expect`.
- **A test does not measure its own time.** Do not use `performance.now()`,
  `Date.now()` or `toBeLessThan(<ms>)` in a unit test. A wall-clock
  assertion passes on a fast machine and fails on the CI runner. Count the
  work instead, or make the input so large that the bad version cannot
  finish within the timeout. To prove that a new bound works, put the bug
  back once and see the test fail.
- **Share the test helpers.** Keep one builder for each domain object in
  `src/test/`. A new test file uses those builders, not its own literals.
- **CI checks the order and the environment of the tests.** Each week, CI
  runs the suite in a random order, in a different time zone and locale. It
  prints the seed and the command that runs the same order again. A test
  that passes only in alphabetical order and in UTC does not test what it
  claims.
- **Mutation testing** is for code where a wrong answer is silent. Stryker
  runs over that code each week. Its floor is a ratchet, like the coverage
  floor, and it does not block pull requests. A mutant that survives is a
  test to write, or an equivalent mutant that you record with its reason.
  Kill a mutant with a test that asserts behaviour, not with a test that
  only moves the number.
