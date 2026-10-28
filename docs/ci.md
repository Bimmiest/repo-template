---
type: reference
---

# CI

Each CI job, what makes it fail, and where its rule is. CONTRIBUTING.md has the rules.

| Job | What makes it fail | Where the rule is |
|---|---|---|
| `verify` | Lint, format, types, the test suite and its coverage floor, a floor that is out of date, the build, the documentation checks of [documentation.md](documentation.md), and the licences of production dependencies | The scripts in `package.json`, `vitest.config.ts`, `.docs-check.json`, `.licence-allowlist.json` |
| `audit` | A high or critical advisory in a production dependency, with no exception | `.audit-exceptions.json` |
| `dependency-review` | A pull request that adds a dependency with a high advisory | The GitHub dependency graph |
| `workflow-lint` | actionlint and zizmor findings in `.github/` | The workflows |
| `PR hygiene` | A branch or an issue link that does not follow the convention | [CONTRIBUTING.md](../CONTRIBUTING.md#branches) |
| `Security` | A secret anywhere in the history, or a fixable CRITICAL or HIGH vulnerability or misconfiguration in the tree | `.gitleaks.toml`, `.trivyignore.yaml` |
| `Scorecard` (weekly and on `main`) | Nothing. It reports the OpenSSF Scorecard checks, to the README badge and to code scanning | The repository settings and the workflows |
| `Settings` (weekly) | A repository setting that differs from the checklist, or that the token cannot read. A failure opens an issue | `docs/repository-settings.md`, `.repo-settings.json` |

A red shared check tells you what to change. Each job can fail
independently, on purpose: a new advisory must not hide the result of the
test suite. If the repository gets a browser suite, it is a job of its own
for the same reason.

## A check that fails only in CI

Compare a full run with a full run:

1. Run the workflow on `main` to get a baseline: `gh workflow run ci.yml --ref main`.
2. Compare two runs on `main` with the runs on your branch. One run is not evidence.
3. Compare the duration of each test in the job logs. If only the failed test
   changed, the cause is a race, not a slow runner.
4. Make the failed assertion show the value that it has. Push this change as a
   temporary commit.

A test that runs alone proves nothing. It can pass alone and fail in the order
of the full suite. A push cancels the run of that branch that is in progress.
Thus, do not start a run again and push at the same time.
