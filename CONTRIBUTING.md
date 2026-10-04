# Contributing

Short on purpose: a document nobody finishes is a document nobody applies. Each rule carries its reason, and a rule whose reason has gone should go with it. Where a rule is enforced, the check that enforces it is named; the rest is kept true by whoever touched it last.

The conventions come from [`repo-template`](https://github.com/Bimmiest/repo-template) and the checks from [`shared-workflows`](https://github.com/Bimmiest/shared-workflows) ([ADR 0001](docs/adr/0001-conventions-come-from-the-template-and-the-shared-workflows.md)). A convention a second repository would want is changed there first.

## Issues first

Open an issue for anything larger than a typo, before writing the code. The issue is where the *why* gets argued while changing it is still cheap; filing one afterwards to record what you already built is the inversion the rule exists to prevent. A closed issue is not a substitute: if the work is new, the issue is new.

An open question that has to be settled before code is written is an issue labelled `decision`. The answer becomes an ADR ([Decisions](#decisions)).

## Branches

Trunk-based: `main` is the only long-lived branch, and every change reaches it through a pull request.

```
<type>/<short-description>-<issue-number>
```

| Type | For |
|---|---|
| `feature/` | New capability |
| `fix/` | A defect in something that already shipped |
| `refactor/` | Behaviour unchanged, shape improved |
| `docs/` | Documentation, ADRs, this file |
| `ci/` | Workflows, checks, build tooling |
| `chore/` | Dependencies, config, housekeeping |

The description is lower-case kebab. Omit the trailing number only when there is genuinely no issue, and label the pull request `no-issue`. CI's **PR hygiene** check enforces the pattern, the number and the link in the description; it re-runs when the description or the labels change, so most failures are fixed with an edit rather than a push.

**One branch per coherent piece of work.** A feature, a fix, a decision. Work that is mutually dependent belongs together; work that is merely adjacent does not.

If a tool assigned you a non-conforming branch (an automated `claude/…` name, say), rename it and reopen the pull request from the renamed branch, and say so in the description. GitHub cannot change a pull request's head branch.

## Commits

Subject in the imperative. Body says **why**, including what the choice cost; a message that only says what changed duplicates the diff. The bar: someone running `git blame` on this line in a year should find the reasoning, not a restatement.

- Reference issues with a closing keyword **per issue**: `Closes #1, closes #2`. `Closes #1, #2` closes only #1.
- When an operator must *act* on a change (a manual step, a variable renamed or re-meant, stored data to purge, a default that changes what a deployment does), add a line on its own anywhere in the message: `Upgrade-Note: <what to do, in one sentence>`. The bar is action, not interest.
- A commit that only reformats goes in `.git-blame-ignore-revs`, one hash per line, oldest first, under a comment naming it.

Pull requests are squash-merged with the branch's commit messages as the body, so what you write at commit time is what `main` keeps, and an `Upgrade-Note:` in any commit survives the squash. The pull request description is for the reviewer; write both to the standard above.

## Pull requests

Run all of these locally first. CI runs the same ones, plus the shared checks described below.

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
```

The template has four sections: **What and why** (including what it cost), **Decisions** (link the ADR or delete the section), **Verification** (what you ran and what it said; "tests pass" is a claim, the output is the evidence), and **Not done** (what a reader might assume is here and is not). Delete a section that does not apply; an empty heading left behind is worse than no heading.

Formatting is Prettier's and is not discussed in review.

### What CI runs

| Job | Gates on | Where the rule is |
|---|---|---|
| `verify` | lint, format, typecheck, the test suite with its coverage floor, the floor being current, the build, documentation links and the ADR index, production dependency licences | `package.json` scripts; `vitest.config.ts`; `.licence-allowlist.json` |
| `audit` | a high or critical advisory in a production dependency that is not excepted | `.audit-exceptions.json` |
| `dependency-review` | a pull request adding a dependency with a high advisory | GitHub's dependency graph |
| `workflow-lint` | actionlint and zizmor over `.github/` | the workflows themselves |
| `PR hygiene` | the branch and issue convention above | this file |
| `Security` | a secret anywhere in the history; a fixable CRITICAL or HIGH vulnerability or misconfiguration in the tree | `.gitleaks.toml`, `.trivyignore.yaml` |

A red shared check prints what to change. Each of these jobs can fail independently, and on purpose: a new advisory should not hide the test suite's verdict, and the browser suite, if the repository grows one, is a job of its own for the same reason.

## Tests

- Vitest, `node` environment, `*.test.ts` beside the code it tests. A test that needs a DOM opts in per file.
- **The coverage floor is a ratchet, and both pawls are enforced.** `vitest.config.ts` fails a run under the floor; CI's coverage-ratchet fails one more than a point above it and prints the thresholds to write. Raise a floor in the same change that raises coverage; never lower one to make a branch green. Nothing is excluded to flatter the numbers, and every exclusion has its reason beside it.
- **What makes a test a test** is linted: a case with no assertion, two cases with one name, or an `expect` that is never finished or never awaited fails lint. A helper that asserts for the test is named `expect…`.
- **A test does not time itself.** No `performance.now()`, `Date.now()` or `toBeLessThan(<ms>)` in a unit test; a wall-clock assertion passes on a fast machine and fails on the runner. Count work instead, or size the input so the bad version cannot finish within the timeout, and check that a new bound bites by reintroducing the bug once.
- **Scaffolding is shared.** One builder per domain object in `src/test/`; a new test file uses those rather than defining its own literal.
- **Order and environment are checked, not assumed.** Weekly, CI runs the suite shuffled, under another time zone and locale, and prints the seed and the command that replays it. A test that only passes in alphabetical order under UTC is a test that has stopped testing.
- **Mutation testing**, when the repository has code where a wrong answer is silent: Stryker over that code, weekly, with a floor that is a ratchet like coverage's and not a pull request gate. A surviving mutant is a test to write, or an equivalent mutant recorded with its reason. Kill a survivor with a test that asserts behaviour, not one written to move the number.

## Code style

- **Prettier owns layout** (`npm run format`). The configuration is `.prettierrc.json`; generated files go in `.prettierignore` with the script that regenerates them named beside them.
- **ESLint catches mistakes.** typescript-eslint `strictTypeChecked`, type-aware. Every rule tuned away from the preset sits beside its reason in `eslint.config.js`. If a rule is wrong for this codebase, turn it off there with the sentence saying why, never with an `eslint-disable` at the call site. A deliberate single exception (a deprecated API used on purpose) gets an inline disable that says so.
- **No `!` in shipped code.** Narrow instead: destructure, iterate rather than index, check for `undefined`. Tests are exempt.
- **A `switch` over a union has no `default`.** The exhaustiveness rule then makes a new member a compile error at every switch.
- **Size ceilings**: 100 lines per function and a cyclomatic complexity of 25, blanks and comments not counted, so keep writing the rationale. Tests are exempt.
- **Imports** in three groups: Node built-ins, packages, the project's own files. `eslint --fix` applies it.
- **A layer that must stay pure** (a simulation engine, a parser) gets a `no-restricted-imports` block naming what it may not import and why, and a test that lints a real import line against the rule so a change to the config cannot quietly stop it matching. `eslint.config.js` has the block commented as a model.
- **Adopting a rule over existing code**: list the findings that exist on the day, per file and per rule, in an allowlist a test holds to. New code gets no exemptions, the list only shrinks, and when you fix a listed finding you lower its count in the same change.
- **TypeScript** is strict with the extra flags in `tsconfig.base.json`, each with its reason. `typescript` is pinned with `~`, not `^`: it does not follow semver, and it moves together with typescript-eslint.

## Dependencies

- **A caret range, and the lockfile is the pin.** An exception (the `typescript` tilde) is written beside its reason.
- **Declared where it is imported.** In a workspaces repository, a package is declared in the workspace that uses it, not also at the root, and one range per name across manifests.
- **Dependabot** proposes updates weekly with a seven-day cooldown: minor and patch grouped, majors one at a time, and every `ignore` entry in `.github/dependabot.yml` carries its reason.
- **Advisories get read, not auto-applied.** `npm audit fix --force` has proposed moving a dependency thirteen minors backwards. A high advisory with no reachable path is listed in `.audit-exceptions.json` with the reason and an expiry; an expired or unneeded entry fails CI.
- **Licences.** A production dependency's licence is on `.licence-allowlist.json`, or the package is named there with the version somebody read and why it is acceptable.
- **A git dependency is pinned by commit**, never a tag (a tag can be moved), and ships a checksum CI verifies.
- **Install scripts do not run in CI** (`npm ci --ignore-scripts`). A dependency that needs its install hook is named in the workflow with the reason.
- **Node** is pinned exactly in `.nvmrc`; `engines` and `engine-strict=true` in `.npmrc` hold local installs to it. CI warns on a pull request and fails monthly when `.nvmrc` is behind the newest patch of its line. `@types/node` majors move with `.nvmrc`, not before it.
- **Every action is pinned by commit sha** with the version in a trailing comment, which Dependabot reads and rewrites with the sha. A tag is a pointer its owner can move over a job holding a checkout.

## Decisions

A choice that outlives the pull request goes in `docs/adr/` as its own record: the context that forced it, the choice, and what it costs. [`docs/adr/README.md`](docs/adr/README.md) has the template, the conventions and the index.

- **Immutable.** A superseded decision gets a new ADR and a status change on the old one, never an edit. Do not edit an ADR to track implementation status.
- **Numbered in order, never reused.** A gap is explained under "Numbers with no record". CI's docs-check holds the index to the directory and the directory to the index.
- **A plan document is not kept** once the plan ships: decisions go to ADRs, open work to issues, and `git log` keeps the plan.

## Documentation

**A change updates the documents it dates, in the same change.** Not afterwards, and not in a follow-up issue: a document updated a week later was wrong for a week.

| Document | Update it when |
|---|---|
| `CHANGELOG.md`, under `Unreleased` | anything a user would notice; one or two sentences and the issue link |
| `README.md` | a capability is added or changes shape, or a caveat stops being true |
| `docs/adr/` | a decision outlives the pull request: a new record **and** its index row |
| the commit message | an operator must act: one `Upgrade-Note:` line |
| `SECURITY.md` | the attack surface changes: a new input path, a new place data is stored or sent |
| `CLAUDE.md` | a rule starts getting broken, or a mistake turns out to be expensive and non-obvious |

Only the mechanical parts are checked (links, the ADR index, root licences in the README). Whether a paragraph is still true is a judgement, and yours.

- **A fact the tooling can derive is not maintained by hand.** No test counts in the README; `npm test` prints it.
- **Code comments** say what the code does now and which constraint makes it non-obvious. History is a pointer: `See docs/adr/NNNN-title.md.`
- **Every deviation in a config file carries its reason inline**: a tuned lint rule, a tsconfig flag turned off, a Dependabot ignore, an `overrides` entry, a `# zizmor: ignore[...]`.
- **`CLAUDE.md` is one screen.** It does not summarise this file; it names the rules that get broken and the ones that are expensive to get wrong. No status, no roadmap.

## Security

- Report a vulnerability as [`SECURITY.md`](SECURITY.md) says, privately.
- **A real key is rotated, never allowlisted.** `.gitleaks.toml` allowlists a path only when the value is provably not a credential, and its two load-bearing lines (`useDefault = true`, the singular `[allowlist]`) are explained in the file.
- **`.trivyignore.yaml`** records a decision with its reason and both spellings of the check ID; it is not where findings nobody wants to read go.
- **Untrusted text reaches a shell only through the environment.** A pull request's body or branch name, an issue title, a commit message: never `${{ }}` inside `run:`.
- **Repository settings that are not files**, set once and verified when they change: branch protection on `main` requiring a pull request and the checks above by name, with force-push and deletion blocked; private vulnerability reporting on; Dependabot alerts on. propslab verifies its settings weekly through the API (`scripts/check-production-environment.mjs`); copy that when the settings matter enough.

## Releases

SemVer: breaking changes increment MAJOR, features MINOR, fixes PATCH. A release is a marker, not a build: nothing is triggered by a tag.

1. On a branch, rename `## Unreleased` in `CHANGELOG.md` to `## x.y.z — YYYY-MM-DD` and add a fresh empty `## Unreleased` above it.
2. `npm version x.y.z --no-git-tag-version` (updates `package.json` and the lockfile).
3. Open a pull request; merge once CI is green.
4. Tag the merge commit: `git tag -a vx.y.z <sha> -m "Release x.y.z"` and push the tag. The tag is a bookmark for people.

A continuously deployed service may decide instead that **the commit sha is the release**: no version numbers, no tags, no changelog, `git log` as the record and `Upgrade-Note:` lines as the operator-facing part of it (propslab-ent ADRs 27 and 134). That is a decision; record it as an ADR and delete `CHANGELOG.md` in the same change.
