# 0006. One rule script, three callers, and only CI enforces

- **Status:** Accepted
- **Date:** 2026-11-14
- **Issue:** #47

## Context

`CLAUDE.md` is advice. A model can skip a rule, and a person can forget one.
The "Expensive to get wrong" list holds the rules where one mistake costs the
most. Most of them are mechanical: a check can find each mistake in the
text of a change.

Three places can run a check:

- CI, on each pull request. A person cannot skip it.
- A git hook, on each commit and push of a person. `--no-verify` skips it,
  and a checkout without `core.hooksPath` does not run it.
- A Claude Code `PreToolUse` hook, before each tool call of a Claude session.
  It applies only to Claude sessions, and a hook that reads the text of a
  command does not see each form that the same command can have.

Two copies of the same logic give two verdicts after the first change to
one of them. The rules also apply in other repositories, and a hook runs
with no install, so the logic cannot be a dependency.

## Decision

`scripts/check.mjs` holds each mechanical rule, in one module for each rule
in `scripts/checks/`. It has no dependency. Each caller gives it the change
that it has, and gets the same verdict:

- CI runs `--base <ref>` in the `verify` job.
- `.githooks/pre-commit` runs `--staged`, and `.githooks/pre-push` runs the
  branch rule. The `prepare` script of `package.json` sets `core.hooksPath`.
- `.claude/settings.json` runs `--hook`, which builds the change of a Write,
  an Edit, a `git commit` or a `git push` from the input of the tool call.
  It runs `--gate -- npm run gates` before Claude opens a pull request.

Only CI enforces. The hooks give the verdict earlier, and do not replace a
check in CI. Thus a hook that cannot run lets the call go ahead, with a
notice, and does not refuse it: CI checks the same change later.

## Consequences

- A rule changes in one place. A new rule is a module in `scripts/checks/`,
  and each caller runs it with no other change.
- A Claude session gets a refusal at the tool call, with the text that says
  what to change. This costs one Node process for each Edit, Write and Bash
  call, and the gates before each pull request.
- A fail-open hook can miss a mistake when it breaks. The notice in the
  transcript shows the break, and CI finds the mistake.
- The hooks run on the computer of each contributor. A change to `.claude/`
  or `.githooks/` gets the review of a workflow change, and `CODEOWNERS`
  names both directories.
- The permission deny rules in `.claude/settings.json` are a guard against
  mistakes. They match the text of a command, so they are not a security
  boundary. The tag ruleset of the repository protects the release tags.
