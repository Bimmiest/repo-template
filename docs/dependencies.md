---
type: reference
---

# Dependencies

The rules for dependencies, and how to review an update. CONTRIBUTING.md has the summary.

## The rules

- **Use a caret range. The lockfile is the pin.** Write the reason next to
  each exception (for example, the `~` on `typescript`).
- **Declare a package where you import it.** In a repository with
  workspaces, declare each package in the workspace that uses it, not also at
  the root. Use one range for each name across all manifests.
- **Dependabot** proposes updates each week, with a seven-day cooldown. It
  groups minor and patch updates, and proposes each major on its own. Each
  `ignore` entry in `.github/dependabot.yml` has its reason. An entry that
  holds a version until something changes also names its `tech-debt` issue
  ([Tech debt](development.md#tech-debt)).
- **Read the lockfile diff of each Dependabot pull request.** A nested copy,
  such as `+ "packages/web/node_modules/<package>"`, tells you that the top
  level cannot take that version. `npm ci` then installs the package with a
  peer dependency that is not satisfied, and `verify` can stay green. To
  correct this, run `npm dedupe`, or update the related packages in one change.
- **Do not fix a group on the Dependabot branch.** If one package of a group
  merges separately, Dependabot closes the group, deletes its branch and opens
  a new group. Put the fix on a `chore/` branch from `origin/main`, and close
  the group as superseded.
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
- **Node** has an exact version in `.nvmrc`. `engines` and `devEngines` in
  `package.json`, and `engine-strict=true` in `.npmrc`, refuse a local
  install on an older Node major. When the major changes, change `.nvmrc`,
  `engines` and `devEngines` in the same change. CI fails a pull request when
  `.nvmrc` is outside the range of `engines` or `devEngines`, or when the
  lower bound of a range is on a different major. CI warns on a pull request,
  and fails each month, when `.nvmrc` is behind the newest patch of its line.
  Move the major of `@types/node` with `.nvmrc`, not before it.
- **Pin each action to a commit SHA**, with the version in a comment after
  it. Dependabot reads the comment and updates the SHA and the comment
  together. The owner of a tag can move it while a job holds a checkout.
- **If the upstream of an action has no `vX.Y.Z` tag, pin the SHA of the
  branch head**, with the branch and the date in the comment:
  `@<sha> # <branch> branch, YYYY-MM-DD`. The date is the day that you read
  the head with `git ls-remote`. Dependabot cannot update this pin, so add an
  `ignore` entry for the action in `.github/dependabot.yml`, with the reason.
  The date shows the age of the pin (Bimmiest/repo-template#73).

## In this repository

Put the text of this repository here, and each deviation from a rule above,
with its reason ([the rule](documentation.md#the-template-text-and-the-repository-text)).
The template has no text of its own.
