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

Work that operates now but must change later, such as a held version or a
workaround, is an issue with the label `tech-debt`. Open it in the pull
request that makes the compromise: a compromise that has no issue is not
visible, and nobody plans to remove it
([when and how](docs/development.md#tech-debt)).

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

Run the gates before you open a pull request.
[docs/development.md](docs/development.md#run-the-gates) gives the commands.
CI runs the same commands and the shared checks below.

The pull request template has four sections:

- **What and why**, which includes what the change cost.
- **Decisions**: link the ADR, or delete the section.
- **Verification**: what you ran, and what it said. "Tests pass" is a claim.
  The output is the evidence.
- **Not done**: what a reader can expect to find here that is not here.

Delete a section that does not apply. An empty heading is worse than no
heading.

The formatter sets the formatting. Reviews do not discuss formatting.

[docs/ci.md](docs/ci.md) lists each CI job, what makes it fail and where its
rule is. A red shared check tells you what to change. Do that, and do not find
a way around the check. If a check fails only in CI, follow
[the procedure in ci.md](docs/ci.md#a-check-that-fails-only-in-ci).

## Tests

The rules and their reasons are in [docs/testing.md](docs/testing.md). These
are the rules that people break:

- **The coverage floor is a ratchet.** Do not lower a floor to make a branch
  green. When the ratchet says so, raise the floor in the same change.
- **A test asserts behaviour, and does not measure its own time.**
- **Use the shared test builders**, not new literals. testing.md says where they are.

## Code style

The formatter sets the layout, the linter finds mistakes, and the type check
is strict. [docs/code-style.md](docs/code-style.md) names the tools, and gives
each rule with its reason and the rules for code comments. These are the rules
that people break:

- **Do not turn a lint rule off at a call site.** Turn a wrong rule off in the
  lint config, with the sentence that says why.
- **Do not tell the type check that a value is present.** Narrow the type
  instead. code-style.md gives the form for this stack.
- **A comment says why, for the code as it is now.** For history, link the
  issue or the ADR.

## Dependencies

[docs/dependencies.md](docs/dependencies.md) gives the rules, and how to review
a pull request from the update bot. In short:

- **Give a range in the manifest, and commit the lockfile. The lockfile is the
  pin.**
- **Read each advisory. Do not apply fixes automatically.**
- **Pin each action and each git dependency to a commit SHA, and each image to
  a digest.** A tag can move.
- **CI does not run install scripts.** Name an exception in the workflow, with
  the reason.

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

**Write all documentation in ASD-STE100**
([ADR 0002](docs/adr/0002-documentation-is-simplified-technical-english-and-a-readme-keeps-to-the-fundamentals.md)).
**Put each text in its class, and keep the file within the limit of its
class.** The docs check enforces the limits, and each topic file in `docs/`
declares its type. [docs/documentation.md](docs/documentation.md) gives the
classes, the limits, the types and the STE rules. In short:

| Text | Where it goes |
|---|---|
| A rule that a contributor must follow | This file, in one or two sentences, with a link to the detail |
| The detail of a rule, a recipe, a trap or a troubleshooting step | The topic file of its area in `docs/` |
| A decision that stays true after the pull request | A new ADR in `docs/adr/` |
| Work to do | An issue |
| What changed for a user | `CHANGELOG.md`, under `Unreleased` |

**A change updates the documents that it makes wrong, in the same change.**
Do not do it later or in a follow-up issue: a document that you update a week
later is wrong for a week.

| Document | Update it when |
|---|---|
| `CHANGELOG.md`, under `Unreleased` | A user can see the change. Write one or two sentences, with the issue link. |
| `README.md` | A capability is added or changes shape, or a caveat stops being true |
| `docs/*.md` | The topic of the file changes |
| `docs/README.md` | A topic file is added, renamed or removed |
| `docs/README.md` | A topic file is added, renamed or removed |
| `docs/adr/` | A decision stays true after the pull request: add a new record **and** its row in the index |
| The commit message | An operator must act: add one `Upgrade-Note:` line |
| `SECURITY.md` | The attack surface changes: a new input path, or a new place where data is stored or sent |
| `CLAUDE.md` | People start to break a rule, or a mistake is expensive and not obvious |

CI checks only the mechanical parts: links, the ADR index, the root licences
in the README, the line limits and the topic types. Whether a paragraph is still
true is your decision.

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
  [`docs/repository-settings.md`](docs/repository-settings.md) sets them, and `settings.yml` checks them each week: the merge methods,
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
2. If the repository has a manifest with a version, set it to `x.y.z`. In a
   `node-ts` repository, run `npm version x.y.z --no-git-tag-version`. It
   updates `package.json` and the lockfile.
3. Open a pull request, and merge it when CI is green.
4. Tag the merge commit with `git tag -a vx.y.z <sha> -m "Release x.y.z"`,
   and push the tag. The tag is a bookmark for people.

If nobody picks a version of the repository, **the commit SHA is the
release** ([standard](docs/standard.md#releases), estate ADR 0024). Then there
are no version numbers, no tags and no CHANGELOG. `git log` is the record, and
the `Upgrade-Note:` lines are the part for operators. Say so in one line of the
README, and delete `CHANGELOG.md` in the same change.
