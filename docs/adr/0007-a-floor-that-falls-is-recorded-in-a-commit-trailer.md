# 0007. A floor that falls is recorded in a commit trailer

- **Status:** Accepted
- **Date:** 2026-11-14
- **Issue:** #74

## Context

The `coverage-floor` rule of `scripts/check.mjs` fails each coverage or
mutation floor that falls (#72). Most falls are a mistake: a person lowers a
floor to make a branch green. Some falls are correct. When propslab moved its
engine to a repository of its own, the best-covered code left. Some floors
went down, and some went away. On the last 30 commits of propslab's `main`,
which include that move, the rule fails on 12 floors.

A repository that adopts the rule needs one way to record a correct fall.
The record must say why, and it must stay in git. A label on the pull
request does not work in a hook, and its reason is not in git.

## Decision

A `Floor-Lowered:` trailer in a commit message records one fall:

```
Floor-Lowered: vitest.config.ts thresholds.src/engine/**.lines 97 -> none, the engine moved out (ADR 0023)
```

The value names the config file, the key as the check prints it, the old
value, the new value (`none` for a floor that is gone), and the reason. The
check passes a fall only when a trailer names the same file, key, old value
and new value. A trailer that names no fall of the change fails, so a stale
trailer cannot stay in the history with a false record. The check prints the
trailer line to add for each fall.

- **CI** (`--base`) reads the trailers of the commits of the pull request
  with `git log`, and enforces.
- **The Claude Code hook at a push** reads the commits since `origin/main`,
  and refuses, as CI does.
- **`pre-commit`, a path, and the Claude Code hook at an edit and a commit**
  have no commit message yet. They give each fall as a warning, with the
  trailer line to add, and do not refuse. Only CI enforces
  ([ADR 0006](0006-one-rule-script-three-callers-and-only-ci-enforces.md)).

The trailer is for a fall in the measured code, when code moves out of the
repository or out of a glob. It is not for a test that fails. A reviewer
reads each trailer.

## Consequences

- A correct fall gets a green check, and its reason stays in git. GitHub
  squash-merges a pull request with the commit messages as the body, so the
  line stays in `main`.
- A trailer can hide a fall that is not correct. The check makes the trailer
  exact and visible, and the reviewer decides. The check cannot read the
  reason.
- A trailer goes in a new commit, which can be empty
  (`git commit --allow-empty`). A wrong or stale trailer needs a reword of
  its commit, with `git rebase` and a force-push, because the check compares
  the trailers with the net change of the branch.
- The hooks no longer refuse a lower floor at an edit or a commit. They warn,
  and the push hook and CI fail it. A person who ignores the warning finds
  the failure later.
- The coverage ratchet and the mutation ratchet compare a floor with a
  measurement, not with its old value. They need no trailer.
