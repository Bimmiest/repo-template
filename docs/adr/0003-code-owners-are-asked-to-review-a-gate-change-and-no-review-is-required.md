# 0003. Code owners are asked to review a gate change, and no review is required

- **Status:** Accepted
- **Date:** 2026-11-10
- **Issue:** #10

## Context

The template had `.github/CODEOWNERS` with one line, `* @Bimmiest`. Nothing
read it: the ruleset on `main` does not require a code owner review, and no
check reads the file. The baseline standard lists `CODEOWNERS` in the core
set, so each repository copies a file that does nothing.

Each repository has one maintainer. A forge does not let an author approve
their own pull request. On GitHub, the maintainer is the author of each
change, so a required code owner review blocks each merge. On Forgejo, an
agent account opens most pull requests, and a person merges them, or the
agent merges them when every check is green. Forgejo reads `CODEOWNERS` only
to request a review. It cannot require one.

The changes that need a second look are the changes to the gates: a workflow,
a file that a check reads, and `CODEOWNERS` itself. A change there can turn a
check off.

## Decision

`CODEOWNERS` names an owner for the gate files only, in the forge folder. A
change to a gate file asks the owner for a review. Nothing requires the
review: the ruleset and the branch protection do not require a code owner
review. A repository adds the gate files of each stack that it has, for
example `ansible/.ansible-lint` in an `opentofu-ansible` repository.

On GitHub the patterns are globs. On Forgejo the file is
`.forgejo/CODEOWNERS`, and each pattern is a regular expression.

## Consequences

- On Forgejo, the owner sees each gate change that the agent account makes,
  and can review it before or after the merge. The review is advice: a merge
  does not wait for it.
- On GitHub, the owner is the author, so the forge asks nobody. The file
  starts to ask for reviews when a second person contributes.
- A change to a file that is not a gate asks nobody. On Forgejo, the `*`
  line asked the owner to review each change.
- `repo-settings-check` checks no new setting, because the decision adds
  none.
- To require a review, a repository needs a second maintainer. Then write a
  new ADR that supersedes this one.
