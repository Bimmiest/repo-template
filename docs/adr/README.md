# Architecture decision records

An ADR records one decision: the context that forced a choice, the choice, and what it costs, including the costs, because an ADR that only lists benefits is marketing. Each one keeps the history and the issue trail behind a choice, so the code and the changelog do not have to.

- **Code comments** say what the code does now and which constraint makes it non-obvious. When the reasoning needs history ("we tried X, #123 showed Y"), the comment ends with a pointer: `See docs/adr/0003-title.md.`
- **`CHANGELOG.md`** says what changed for a user, in one or two sentences, and links here when an ADR covers the rationale.
- **ADRs** hold the context and the trade-off.

## Conventions

- Files are named `NNNN-kebab-case-title.md` and numbered in the order they are written, from `0001`. A number is never reused; a number with no file is explained under [Numbers with no record](#numbers-with-no-record).
- An ADR is not rewritten when a decision changes. Write a new one, set the old one's status to `Superseded by NNNN`, and link the two. Do not edit an ADR to track implementation status either; status belongs in issues.
- A choice that outlives the pull request gets a record. A choice not yet made stays an issue, labelled `decision`, until it is: an ADR records a decision, an issue tracks the absence of one.
- Keep an ADR short and factual. Link the issues and pull requests the decision came from, and name the files it governs.
- Every record has a row in the index below, in ascending order. CI's docs-check holds the index to the directory.

## Template

```markdown
# NNNN. Title in sentence case

- **Status:** Proposed | Accepted | Superseded by [NNNN](NNNN-title.md)
- **Date:** YYYY-MM-DD
- **Issue:** #n

## Context

The problem and the constraints, with the issues that surfaced them. The
constraints, not the solution.

## Decision

What the code does, stated as a rule.

## Consequences

What follows, good and bad: what the rule costs, what it rules out, and what
to check when changing it.
```

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-conventions-come-from-the-template-and-the-shared-workflows.md) | Conventions come from the template and the shared workflows | Accepted |

## Numbers with no record

None. When a number is skipped or a record is withdrawn, add a bullet here: `- **N**: why there is no file.`
