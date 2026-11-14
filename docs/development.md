---
type: how-to
---

# Development

How to set up a checkout, run the gates, record tech debt, and find the cause
of a failure. The rules are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Set up

1. Install the Node version in `.nvmrc`: `nvm install`.
2. Install the dependencies: `npm ci`. Its `prepare` script also points git
   at the hooks in `.githooks/` ([the hooks](#the-hooks)).

`devEngines` in `package.json` refuses a Node version outside its range,
before npm resolves the dependencies. The error is `EBADDEVENGINES`, with the
required and the current version. npm also checks `devEngines` before
`npm run`, so a gate on a wrong Node stops with the same error. If you get
this error, run `nvm use` and try again.

`engine-strict=true` in `.npmrc` refuses a dependency whose `engines` range
does not include your Node, with `EBADENGINE`. It also refuses a wrong Node
on an npm older than 10.9.0, which ignores `devEngines`. That npm checks
`engines` only after it resolves the dependencies, so a resolution error can
come first.

## Run the gates

Run the five gates before you open a pull request. CI runs the same commands.
The `gates` script in `package.json` runs the five in order, and stops at the
first failure. The Claude Code hook runs the same script
([the hooks](#the-hooks)).

```bash
npm run gates
```

To run one test file, use `npx vitest run src/path/to/file.test.ts`. To run
the tests that have a name, use `npx vitest run -t "part of the name"`.

To run a shared check locally, clone `shared-workflows` next to this
repository, and run its script from here:

```bash
node ../shared-workflows/.github/actions/docs-check/docs-check.mjs
```

## Check the rules of CLAUDE.md

`scripts/check.mjs` checks the mechanical rules of `CLAUDE.md`. CI runs it
on each pull request ([the rule checks](ci.md#the-rule-checks)). Run it
before you push, and you get the verdict of CI:

```bash
node scripts/check.mjs --base origin/main   # the commits of your branch
node scripts/check.mjs --staged             # the staged files, against HEAD
node scripts/check.mjs path/to/file         # the files on disk, against HEAD
```

The script prints each finding on one line, as
`file:line: rule: what to change`. It exits with 1 when it finds a problem,
with 0 when it finds none, and with 2 when it cannot run. To run some rules
only, add `--only <rule>,<rule>`.

The `branch-name` rule reads the branch pattern of PR hygiene from a clone of
`shared-workflows` next to this repository. If there is no clone, the script
tells you that it did not check the branch. To use a clone in a different
directory, add `--shared-workflows <dir>`.

## The hooks

Hooks run `scripts/check.mjs` before the push, so you get the verdict of CI
earlier. A hook is a help, not a gate. Only CI enforces
([ADR 0006](adr/0006-one-rule-script-three-callers-and-only-ci-enforces.md)).

### The git hooks

`npm ci` runs the `prepare` script, which sets `core.hooksPath` to
`.githooks`. The script does nothing in CI, outside a git checkout, and when
you set a different hooks path. If you install with `--ignore-scripts`, set
the path yourself:

```bash
git config core.hooksPath .githooks
```

| Hook | What it runs |
|---|---|
| `pre-commit` | Prettier and ESLint on the staged files, then each rule of `scripts/check.mjs` except `branch-name`, on the index |
| `pre-push` | The `branch-name` rule on each branch that you push, then `npm run typecheck` |

The tests, the coverage, the build and the mutation tests run in CI only,
because people skip a slow hook. If `node_modules` is not there, the hooks
skip Prettier, ESLint and the type check, and tell you.

### The Claude Code hooks

`.claude/settings.json` gives Claude Code two `PreToolUse` hooks and a list of
deny rules. Claude Code reads the file when a session starts in the
repository.

- **The rule hook** runs `scripts/check.mjs --hook` before each `Edit`,
  `Write`, `Bash` and `PowerShell` call. For an edit, it checks the file
  after the edit, against HEAD. For a `git commit`, it checks the index and
  the branch. For a `git push`, it checks the commits since the merge base
  with `origin/main`, and the branch. A finding refuses the call, and Claude
  gets the finding as the reason. Other commands pass.
- **The gate hook** runs `npm run gates` before `gh pr create` or the
  `mcp__github__create_pull_request` tool. A failure refuses the call.
- **When a hook cannot run**, for example on input that it cannot read, it
  lets the call go ahead. Claude Code then shows a hook error in the
  transcript. CI still checks the pull request.

The hooks read the tool input as data. They do not give a path or a command
to a shell, and they do not run the command that they check.

### The deny rules

The deny rules stop Claude Code before it deletes or moves a tag, or
force-pushes. This repository tags each release by hand
([CONTRIBUTING](../CONTRIBUTING.md#releases)), so Claude can still make a
tag. If a `release.yml` workflow makes the tags, add these rules to the
`deny` list:

```json
"Bash(git tag *)",
"Bash(git push *--tags*)"
```

**The deny rules are a guard against mistakes, not against attacks.** A
rule matches the text of the command. Thus a rule does not stop
`git -c x=y tag -d`, `git -C . push -f`, an alias or a script. The
protection for the release tags is the tag ruleset of the repository. Set
`tagRuleset` in `.repo-settings.json`, and `repo-settings-check` fails when
the ruleset is not there. The check reads the key from the first release of
shared-workflows after v1.13.0 (Bimmiest/shared-workflows#41). Do not remove
the tag ruleset because a deny rule exists.

### Skip a hook

Skip a hook only in an emergency. CI runs the same checks on the pull
request, and a skipped hook only moves the failure to CI.

- To skip the git hooks for one command, add `--no-verify`:
  `git commit --no-verify`.
- To start Claude Code with no hooks, run
  `claude --settings '{"disableAllHooks": true}'`.

### Review a change to a hook

The files in `.claude/` and `.githooks/`, and the `prepare` script, run on
the computer of each person who works in the repository. Thus review a pull
request that changes them as you review a workflow. `CODEOWNERS` asks the
owner for a review of each change there.

## Tech debt

Tech debt is work that operates now but must change later. An issue with the
label `tech-debt` records it, so that people can plan it. A bug is different:
the code does not do what it must. An enhancement is different: it adds
behaviour.

Open the issue, with the form **Tech debt**, in the pull request that makes
the compromise. These are the usual causes:

- **You hold a version back.** An `ignore` entry in `.github/dependabot.yml`
  that holds a version until something changes names the issue. An entry
  that records a permanent rule, for example two packages that always move
  together, gives its reason and needs no issue.
- **A version move needs more than a bump.** A Dependabot pull request that
  cannot pass alone, for example a major that needs a migration, gets an
  issue that says what the move needs. Link the pull request from the issue.
- **A workaround waits for a fix in a different project**, for example a bug
  in a dependency, or a feature that the forge does not have. The comment at
  the workaround names the issue: `TODO(#123): what is not done.`

Before you open an issue, search the open `tech-debt` issues. One cause has
one issue, so two holds that the same migration removes share an issue.

Pay the debt in a change that touches its code, or plan it as other work.
The pull request that removes the hold or the workaround closes the issue. It
also removes the `ignore` entry or the comment.

## Traps

Add a trap below [In this repository](#in-this-repository) when it costs a
contributor time and a check cannot find it. Give the symptom first, then the
cause, then the fix. If a trap belongs to an area, put it below the same
heading in the topic file of that area: [ci.md](ci.md),
[testing.md](testing.md), [code-style.md](code-style.md),
[dependencies.md](dependencies.md) or [documentation.md](documentation.md).

## In this repository

Put the text of this repository here, and each deviation from a rule above,
with its reason ([the rule](documentation.md#the-template-text-and-the-repository-text)).
The template has no text of its own.
