---
type: reference
---

# CI

Each CI job, what makes it fail, and where its rule is. CONTRIBUTING.md has the rules.

## The jobs

| Job | What makes it fail | Where the rule is |
|---|---|---|
| `verify` | A finding of [the rule checks](#the-rule-checks), lint, format, types, the test suite and its coverage floor, a floor that is out of date, the build, the documentation checks of [documentation.md](documentation.md), the licences of production dependencies, and a file of the template that is missing | `scripts/check.mjs`, the scripts in `package.json`, `vitest.config.ts`, `.docs-check.json`, `.licence-allowlist.json`, `.baseline-exceptions.json` |
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

## The rule checks

`scripts/check.mjs` checks the mechanical rules of `CLAUDE.md`. On a pull
request, the `verify` job runs it on the change against the base branch. To
run it before you push, see [development.md](development.md#check-the-rules-of-claudemd).
The git hooks and the Claude Code hooks run the same script before the push
([the hooks](development.md#the-hooks)). Only CI enforces: a person can skip
a hook. The table gives each rule, the check that enforces it in CI, and the
hooks that run it.

| Rule | It fails when | Enforced in CI by | Also runs in |
|---|---|---|---|
| `run-expression` | The `run:` of a step contains `${{` | The script. zizmor finds only the expressions that an attacker can control, for example `github.event.*` | `pre-commit`, and the Claude Code hook at an edit, a commit and a push |
| `uses-pin` | A `uses:` is not `owner/repo@<40-character SHA> # vX.Y.Z` or `owner/repo@<40-character SHA> # <branch> branch, YYYY-MM-DD`, and does not start with `./`. [dependencies.md](dependencies.md#the-rules) says when to use the branch form | The script. zizmor finds a reference with no SHA, but not a SHA with no version comment | `pre-commit`, and the Claude Code hook at an edit, a commit and a push |
| `accepted-adr` | A change edits or deletes an ADR whose status is Accepted. A change of the Status item only, to `Superseded by NNNN`, passes | The script | `pre-commit`, and the Claude Code hook at an edit, a commit and a push |
| `coverage-floor` | A number in a `thresholds` object of `vitest.config.*` or `stryker.config.*` is lower than before, or is not there | The script. The coverage ratchet compares each floor with its measurement, not with its old value | `pre-commit`, and the Claude Code hook at an edit, a commit and a push |
| `eslint-disable` | A new line of a source file has an `eslint-disable` directive | The script | `pre-commit`, and the Claude Code hook at an edit, a commit and a push |
| `branch-name` | The branch does not match `<type>/<short-description>-<issue-number>` | PR hygiene. In CI, HEAD has no branch, and the script does not check one | `pre-push`, and the Claude Code hook at a commit and a push |
| `wasm-pair` | A change has `pcre2.wasm` or `pcre2.wasm.sha256`, and not the other one, in the same directory | The script | `pre-commit`, and the Claude Code hook at a commit and a push. An edit changes one file, so the hook does not check the pair at an edit |

The script reads each file as text, and imports and runs nothing from it. The
comment at the top of each file in `scripts/checks/` gives the limits of the
check.

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

## In this repository

Put the text of this repository here, and each deviation from a rule above,
with its reason ([the rule](documentation.md#the-template-text-and-the-repository-text)).
The template has no text of its own.
