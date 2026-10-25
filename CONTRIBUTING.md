# Contributing

This file is short on purpose: people do not apply a document that they do
not finish. Each rule gives its reason. When the reason stops being true,
remove the rule. When a check enforces a rule, this file names the check.
For the other rules, the last person who changed the text keeps it true.

The conventions come from
[`repo-template`](https://github.com/Bimmiest/repo-template), and the checks
come from [`shared-workflows`](https://github.com/Bimmiest/shared-workflows)
([ADR 0001](docs/adr/0001-conventions-come-from-the-template-and-the-shared-workflows.md)).
If a second repository can use a convention, change it in those repositories
first.

## Issues first

Before you write the code, open an issue for each change that is larger than
a typo. The issue is where people argue about the reason for a change, while
the change is still cheap. An issue that you open after the work, to record
what you built, reverses the purpose of this rule. A closed issue is not a
substitute: new work gets a new issue.

An open question that must have an answer before the code is written is an
issue with the label `decision`. The answer becomes an ADR
([Decisions](#decisions)).

## Branches

`main` is the only long-lived branch. Each change goes to `main` through a
pull request.

```
<type>/<short-description>-<issue-number>
```

| Type | For |
|---|---|
| `feature/` | A new capability |
| `fix/` | A defect in something that shipped |
| `refactor/` | The same behaviour, with a better shape |
| `docs/` | Documentation, ADRs and this file |
| `ci/` | Workflows, checks and build tools |
| `chore/` | Dependencies, configuration and maintenance |

Write the description in lower-case kebab case. Omit the issue number only
when there is no issue, and then add the label `no-issue` to the pull
request. CI's **PR hygiene** check enforces the pattern, the number and the
issue link in the description. The check runs again when the description or
the labels change. Thus an edit, not a push, fixes most failures.

**Use one branch for each coherent piece of work:** a feature, a fix or a
decision. Work that depends on other work goes on the same branch. Work that
is only near other work does not.

If a tool gave you a branch name that does not conform (for example an
automatic `claude/…` name), rename the branch. Then open the pull request
again from the renamed branch, and say so in the description. GitHub cannot
change the head branch of a pull request.

## Commits

Write the subject in the imperative. In the body, say **why**, and say what
the choice cost. A message that only says what changed repeats the diff. The
test: a person who runs `git blame` on this line in a year must find the
reason, not a copy of the change.

- Give each issue its own closing keyword: `Closes #1, closes #2`.
  `Closes #1, #2` closes only #1.
- When an operator must do something because of a change, add a line of its
  own: `Upgrade-Note: <what to do, in one sentence>`. Examples are a manual
  step, a variable with a new name or meaning, or stored data to remove.
  A default that changes what a deployment does is another example. Add the line only when an
  operator must act.
- Put a commit that only changes formatting in `.git-blame-ignore-revs`: one
  hash on each line, oldest first, under a comment that names it.

GitHub squash-merges a pull request, with the commit messages of the branch
as the body. Thus `main` keeps what you write when you commit, and an
`Upgrade-Note:` line in any commit stays in the history. The pull request
description is for the reviewer. Write both to the standard above.

## Pull requests

Run all of these commands before you open a pull request. CI runs the same
commands and the shared checks below.

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
```

The pull request template has four sections:

- **What and why**, which includes what the change cost.
- **Decisions**: link the ADR, or delete the section.
- **Verification**: what you ran, and what it said. "Tests pass" is a claim.
  The output is the evidence.
- **Not done**: what a reader can expect to find here that is not here.

Delete a section that does not apply. An empty heading is worse than no
heading.

Prettier sets the formatting. Reviews do not discuss formatting.

### What CI runs

| Job | What makes it fail | Where the rule is |
|---|---|---|
| `verify` | Lint, format, types, the test suite and its coverage floor, a floor that is out of date, the build, the documentation checks below, and the licences of production dependencies | The scripts in `package.json`, `vitest.config.ts`, `.docs-check.json`, `.licence-allowlist.json` |
| `audit` | A high or critical advisory in a production dependency, with no exception | `.audit-exceptions.json` |
| `dependency-review` | A pull request that adds a dependency with a high advisory | The GitHub dependency graph |
| `workflow-lint` | actionlint and zizmor findings in `.github/` | The workflows |
| `PR hygiene` | A branch or an issue link that does not follow the convention above | This file |
| `Security` | A secret anywhere in the history, or a fixable CRITICAL or HIGH vulnerability or misconfiguration in the tree | `.gitleaks.toml`, `.trivyignore.yaml` |
| `Scorecard` (weekly and on `main`) | Nothing. It reports the OpenSSF Scorecard checks, to the README badge and to code scanning | The repository settings and the workflows |
| `Settings` (weekly) | A repository setting that differs from the checklist, or that the token cannot read. A failure opens an issue | `.repo-settings.json` |

A red shared check tells you what to change. Each job can fail
independently, on purpose: a new advisory must not hide the result of the
test suite. If the repository gets a browser suite, it is a job of its own
for the same reason.

## Tests

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

## Code style

- **Prettier controls the layout** (`npm run format`). The configuration is
  `.prettierrc.json`. Put generated files in `.prettierignore`, with the name
  of the script that makes them.
- **ESLint finds mistakes.** The preset is typescript-eslint
  `strictTypeChecked`, with type information. Each rule that differs from
  the preset has its reason next to it in `eslint.config.js`. If a rule is
  wrong for this code, turn it off there, with a sentence that says why. Do
  not use `eslint-disable` at the call site. One deliberate exception (for
  example, a deprecated API that you use on purpose) gets an inline disable
  that says so.
- **Do not use `!` in code that ships.** Narrow the type instead: destructure
  the value, iterate instead of index, or compare with `undefined`. Tests can
  use `!`.
- **A `switch` over a union has no `default`.** Then the exhaustiveness rule
  makes a new member a compile error at each `switch`.
- **Size limits:** 100 lines for each function and a cyclomatic complexity of
  25. Blank lines and comments do not count, so continue to write the
  reasons. Tests do not have these limits.
- **Imports** are in three groups: Node built-ins, packages, then the files
  of the project. `eslint --fix` sorts them.
- **A layer that must stay pure** (for example a simulation engine or a
  parser) gets a `no-restricted-imports` block. The block names what the
  layer must not import, and why. A test lints a real import line against
  the rule, so that a change to the configuration cannot stop the rule
  without a failure. `eslint.config.js` has a commented example of the block.
- **When you adopt a rule over existing code**, list the findings of that
  day in an allowlist, by file and by rule. A test holds the list. New
  code gets no exceptions. The list only gets shorter. When you fix a listed
  finding, lower its count in the same change.
- **TypeScript** is strict, with the extra flags in `tsconfig.base.json`.
  Each flag has its reason. Pin `typescript` with `~`, not `^`: TypeScript
  does not follow semantic versioning, and it moves with typescript-eslint.

## Dependencies

- **Use a caret range. The lockfile is the pin.** Write the reason next to
  each exception (for example, the `~` on `typescript`).
- **Declare a package where you import it.** In a repository with
  workspaces, declare each package in the workspace that uses it, not also at
  the root. Use one range for each name across all manifests.
- **Dependabot** proposes updates each week, with a seven-day cooldown. It
  groups minor and patch updates, and proposes each major on its own. Each
  `ignore` entry in `.github/dependabot.yml` has its reason.
- **Read each advisory. Do not apply fixes automatically.** One time,
  `npm audit fix --force` proposed to move a dependency thirteen minor
  versions back. If a high advisory has no path that the code can reach,
  list it in `.audit-exceptions.json` with the reason and an expiry date. An
  entry that has expired, or that no advisory needs, fails CI.
- **Licences.** The licence of each production dependency is on
  `.licence-allowlist.json`. Otherwise the file names the package, the
  version that a person read, and why it is acceptable.
- **Pin a git dependency to a commit**, not a tag, because a tag can move.
  The dependency ships a checksum that CI verifies.
- **CI does not run install scripts** (`npm ci --ignore-scripts`). If a
  dependency needs its install script, name it in the workflow with the
  reason.
- **Node** has an exact version in `.nvmrc`. `engines`, and
  `engine-strict=true` in `.npmrc`, hold local installs to it. CI warns on a
  pull request, and fails each month, when `.nvmrc` is behind the newest
  patch of its line. Move the major of `@types/node` with `.nvmrc`, not
  before it.
- **Pin each action to a commit SHA**, with the version in a comment after
  it. Dependabot reads the comment and updates the SHA and the comment
  together. The owner of a tag can move it while a job holds a checkout.

## Decisions

A choice that stays true after the pull request is merged goes in
`docs/adr/` as a record of its own. The record gives the context that forced
the choice, the choice, and what it costs.
[`docs/adr/README.md`](docs/adr/README.md) has the template, the conventions
and the index.

- **An ADR does not change.** When a decision changes, write a new ADR and
  change the status of the old one. Do not edit an ADR to record the status
  of the work.
- **Number the ADRs in order, and do not use a number again.** Explain each
  gap under "Numbers with no record". CI's docs check holds the index and the
  directory to each other.
- **Do not keep a plan document** after the plan ships. Decisions go to
  ADRs, open work goes to issues, and `git log` keeps the plan.

## Documentation

**Write all documentation in ASD-STE100 Simplified Technical English**
([ADR 0002](docs/adr/0002-documentation-is-simplified-technical-english-and-a-readme-keeps-to-the-fundamentals.md)).
This rule applies to each new or changed text: the README, the files in
`docs/`, this file, `SECURITY.md`, `CLAUDE.md`, ADRs and the CHANGELOG. It
does not apply to an accepted ADR, which does not change, or to third-party
text such as the Contributor Covenant. The main rules:

- One topic in each sentence, and one instruction in each procedure step.
- A maximum of 20 words in a procedure step, and 25 words in descriptive
  text. A maximum of six sentences in a paragraph.
- Use the active voice, and the imperative for an instruction. Put a
  condition first ("If the test fails, …").
- Use simple present, past or future tenses. Do not use "-ing" forms, except
  in technical names.
- Use "must" for an obligation, "can" for an ability, and "do not" for a
  prohibition. Do not use `should`, `may`, `might` or `would`.
- Use the same word for the same thing each time. Do not leave out "the",
  "a" or "an". Use a maximum of three nouns in a row.
- Do not use phrasal verbs, contractions, semicolons in prose, or `e.g.`,
  `i.e.` and `etc.`. The docs check warns on these words in the files
  that `ste` names in `.docs-check.json`.
- Do not change code, commands, file names or product names: they are
  technical names.

**The README keeps to the fundamentals, in a maximum of 200 lines.** CI's
docs check enforces the limit (`readmeMaxLines` in `.docs-check.json`). The
README has these sections, in this order:

1. A banner, the CI, security and licence badges, the name, and one sentence
   that says what the product is.
2. **Highlights:** three to five bullets.
3. **Overview:** what the product does, how mature it is, and what it is not.
4. **Demo:** a screenshot or a short GIF, from `docs/assets/`.
5. **Usage** and **Installation:** one or two commands each.
6. **Documentation:** a table of the documents, with a row for each file in
   `docs/`.
7. **Contributing and feedback**, and **Licence**.

**Put technical detail in `docs/`.** If a topic needs more than a few lines,
give it its own file in `docs/`. Link the file from the Documentation table
of the README. Do not use a wiki. A wiki change gets no
review and no link check. Also, GitHub does not give a wiki to a private
repository on the Free plan.

**A change updates the documents that it makes wrong, in the same change.**
Do not do it later or in a follow-up issue: a document that you update a week
later is wrong for a week.

| Document | Update it when |
|---|---|
| `CHANGELOG.md`, under `Unreleased` | A user can see the change. Write one or two sentences, with the issue link. |
| `README.md` | A capability is added or changes shape, or a caveat stops being true |
| `docs/*.md` | The topic of the file changes |
| `docs/adr/` | A decision stays true after the pull request: add a new record **and** its row in the index |
| The commit message | An operator must act: add one `Upgrade-Note:` line |
| `SECURITY.md` | The attack surface changes: a new input path, or a new place where data is stored or sent |
| `CLAUDE.md` | People start to break a rule, or a mistake is expensive and not obvious |

CI checks only the mechanical parts: links, the ADR index, the root licences
in the README, and the length of the README. Whether a paragraph is still
true is your decision.

- **Do not write by hand a fact that a tool can give.** Do not put test
  counts in the README: `npm test` prints them.
- **Code comments** say what the code does now, and which constraint makes it
  not obvious. For history, a comment points to the ADR:
  `See docs/adr/NNNN-title.md.`
- **Each deviation in a configuration file has its reason in the same
  file:** a changed lint rule, a tsconfig flag that is off, a Dependabot
  ignore, an `overrides` entry, or a `# zizmor: ignore[...]`.
- **`CLAUDE.md` is one screen.** It does not summarise this file. It names
  the rules that people break, and the rules where a mistake is expensive. It
  has no status and no plan.

## Security

- Report a vulnerability privately, as [`SECURITY.md`](SECURITY.md) says.
- **Rotate a real key. Do not allowlist it.** `.gitleaks.toml` allowlists a
  path only when the value is not a credential, and you can prove it. The
  file explains its two important lines (`useDefault = true` and the
  singular `[allowlist]`).
- **`.trivyignore.yaml`** records a decision, with its reason and both
  spellings of the check ID. It is not a place for findings that nobody
  wants to read.
- **Untrusted text gets to a shell only through the environment.** This
  includes the body or branch name of a pull request, the title of an issue
  and a commit message. Do not put `${{ }}` in a `run:` block.
- **Some repository settings are not files.** The checklist in
  [`docs/starting-from-the-template.md`](docs/starting-from-the-template.md)
  sets them, and `settings.yml` checks them each week: the merge methods,
  the wiki, the Actions permissions, private vulnerability reporting,
  Dependabot alerts, secret scanning, and the ruleset on `main`. When a
  setting must differ, add an exception with the reason to
  `.repo-settings.json`. When the ruleset requires a new check, add its name
  there too.

## Releases

Use semantic versioning. A breaking change increments MAJOR, a feature
increments MINOR and a fix increments PATCH. A release is a marker, not a
build: a tag starts nothing.

1. On a branch, change `## Unreleased` in `CHANGELOG.md` to
   `## x.y.z — YYYY-MM-DD`. Add a new, empty `## Unreleased` above it.
2. Run `npm version x.y.z --no-git-tag-version`. It updates `package.json`
   and the lockfile.
3. Open a pull request, and merge it when CI is green.
4. Tag the merge commit with `git tag -a vx.y.z <sha> -m "Release x.y.z"`,
   and push the tag. The tag is a bookmark for people.

A service that deploys each commit can decide that **the commit SHA is the
release**. Then there are no version numbers, no tags and no CHANGELOG.
`git log` is the record, and the `Upgrade-Note:` lines are the part for
operators (propslab-ent ADRs 27 and 134). That is a decision: record it as an
ADR, and delete `CHANGELOG.md` in the same change.
