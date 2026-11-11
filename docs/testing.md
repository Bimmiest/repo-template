---
type: reference
---

# Tests

The rules for tests, and their reasons. CONTRIBUTING.md has the summary.

Each repository that comes from the template follows these rules. If a
repository keeps a different rule, it records the rule as a deviation below
[In this repository](#in-this-repository), with the reason (template
[ADR 0004](https://github.com/Bimmiest/repo-template/blob/main/docs/adr/0004-one-point-of-coverage-slack-tests-next-to-the-code-and-mutation-on-the-changed-files.md)).

## The rules

- Use Vitest, with the `node` environment. A test that needs a DOM selects
  it in its own file.
- **Put each `*.test.ts` file next to the code that it tests**, not in a
  `__tests__/` directory. Then a file that has no test is visible in its
  directory, and a file and its test move together.
- **The coverage floor is a ratchet, in both directions.** `vitest.config.ts`
  fails a run that is below the floor. CI's coverage ratchet fails a run that
  is more than one point above the floor, and prints the thresholds to
  write. Raise a floor in the change that raises the coverage. Do not lower
  a floor to make a branch green.
- **The slack of the ratchet is one point**, the default of its `slack`
  input. More slack lets the coverage fall by that number of points with no
  red build. A repository that needs more slack records it as a deviation,
  with the reason. An example is a job on a different platform that measures
  a lower figure.
- **Do not exclude code to make the numbers look better.** Each exclusion
  has its reason next to it.
- **Lint checks what makes a test a test.** These fail lint: a case with no
  assertion, two cases with one name, and an `expect` that is not finished
  or not awaited. Give a helper that asserts for the test a name
  that starts with `expect`.
- **A unit test does not measure its own time.** Do not use
  `performance.now()`, `Date.now()` or `toBeLessThan(<ms>)` in a unit test.
  A wall-clock assertion passes on a fast machine and fails on the CI runner.
  Count the work instead, or make the input so large that the bad version
  cannot finish within the timeout. To prove that a new bound works, put the
  bug back once and see the test fail.
- **A time budget goes in a test project of its own, with no retries.** A
  retry lets a slow change pass by chance on its second run. The other
  projects can keep their retries. Set each budget from a measurement on the
  CI runner, with a margin for a loaded runner. Write each measured figure
  to the job summary, next to its budget. Then a reader sees a figure that
  moves toward its budget before the test fails.
- **Share the test helpers.** Keep one builder for each domain object in
  `src/test/`. A new test file uses those builders, not its own literals.
- **CI checks the order and the environment of the tests.** Each week, CI
  runs the suite in a random order, in a different time zone and locale. It
  prints the seed and the command that runs the same order again. A test
  that passes only in alphabetical order and in UTC does not test what it
  claims.

## The test layers

Choose the layer of each test for the failure that the test finds. Each
layer finds a failure that the other layers cannot find. Before you write a
test, name the failure that it must find. Then write the test in the layer
that finds that failure.

Do not ask for a test in each layer for each line. That rule gives slow
suites that fail together on one change, and that find no more failures.

| Layer | The failure that only this layer finds |
|---|---|
| Unit | One function gives a wrong result for one input. The failure names the function, and the test runs in milliseconds. |
| Integration | Each part is correct alone, and the parts are wrong together. An example is a call in the wrong order, or a value that the next part does not expect. |
| End-to-end | The built product fails in its real environment: a policy of the browser or the platform refuses it, or a bundle does not load. |
| Performance | A change gives the correct result, but too slowly. |
| Mutation | A test runs a line, and no assertion checks that line. Coverage cannot find this, because coverage counts only the lines that ran. |

For each of its layers, a repository lists below
[In this repository](#in-this-repository) the failures that no test found
before. Next to each failure, it names the test that now finds it. The
end-to-end section of `docs/testing.md` in propslab is an example.

## Mutation testing

Mutation testing is for code where a wrong answer is silent. Stryker makes
one small change to that code at a time, and checks that a test fails. The
`mutate` list in the Stryker config names the code. The mutation score has
a floor, and the floor is a ratchet, like the coverage floor.

A mutant that survives is a test to write, or an equivalent mutant that you
record with its reason. Kill a mutant with a test that asserts behaviour,
not with a test that only moves the number.

A workflow of its own runs Stryker (template
[ADR 0004](https://github.com/Bimmiest/repo-template/blob/main/docs/adr/0004-one-point-of-coverage-slack-tests-next-to-the-code-and-mutation-on-the-changed-files.md)):

- **A full run each week, and on demand.**
- **On a pull request, only the changed code.** The run mutates the files in
  the `mutate` list that the pull request changes. It also mutates the source
  files whose tests the pull request changes, because a change to a test can
  make the test weaker. It holds these files to the floor. Thus a weakly
  tested change fails on its own pull request, and not in a weekly run with
  no pull request to blame.
- **The check is not a required check.** A required check makes each merge
  wait for the mutation run, which is slow. A red run is visible on the pull
  request, and the reviewer decides if the change can merge.
- **Each job finishes well inside the time limit of one job on its runner.**
  The limit is 6 hours on a runner that GitHub hosts. A job that gets to the
  limit stops, and gives no score. If the full run does not fit, divide the
  `mutate` list across the jobs of a matrix. Then hold the combined score to
  the floor.

**A canary proves that the runner works.** When Stryker, its test runner or
the test framework changes version, mutate one small file that has good
tests. Fail if almost all of its mutants survive. A broken runner looks like
a weak suite, because each mutant survives in both cases. The easy way is to
run the canary first in each mutation run. propslab does this with its
`test:mutation:canary` script and `scripts/check-mutation-canary.mjs`.

## In this repository

Put the text of this repository here, and each deviation from a rule above,
with its reason ([the rule](documentation.md#the-template-text-and-the-repository-text)).
The template has no text of its own.
