---
type: reference
---

# Repository settings

A file in the repository cannot hold these settings, and a template copies
files, not settings. Thus you must set each of these on each repository that
you make from the template. `settings.yml` compares the settings with this
checklist each week, and a difference opens an issue. When a setting must
differ, add an exception with the reason to `.repo-settings.json`. When the
ruleset requires a new check, add its name to `requiredChecks` in the same
file.

- **Actions, General.** Set the workflow permissions to read-only, with
  no permission to create or approve pull requests. Require approval for
  workflows from the forks of **all** external contributors. Require
  actions to be pinned to a full-length commit SHA. Each `uses:` in the
  template is pinned already, and GitHub accepts a `./` reference to the
  same repository. Because of the pin requirement, "Allow all actions" is
  acceptable. If you want a stricter allowlist, use `actions/*`,
  `github/*`, `Bimmiest/*`, `gitleaks/gitleaks-action@*`,
  `aquasecurity/trivy-action@*`, `ossf/scorecard-action@*` and
  `zizmorcore/zizmor-action@*`.

  ```bash
  echo '{"enabled":true,"allowed_actions":"all","sha_pinning_required":true}' | gh api -X PUT repos/Bimmiest/new-repo/actions/permissions --input -
  gh api -X PUT repos/Bimmiest/new-repo/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
  gh api -X PUT repos/Bimmiest/new-repo/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
  ```

- **Branches, `main`.** Require a pull request. Require these status
  checks by name: `verify`, `audit`, `workflow-lint / workflow-lint`,
  `pr-hygiene`, `security / gitleaks` and `security / trivy`. Block
  force-push and deletion. When the dependency graph is on, also require
  `dependency-review`. GitHub offers a check by name only after it has
  run once, so open the first pull request before you do this step.
  `.repo-settings.json` lists the same names, and the CodeQL checks
  below. If you require a different set, change the file too.

- **Security.** Enable private vulnerability reporting, Dependabot
  alerts, the dependency graph and the CodeQL default setup. When the
  `Analyze (…)` checks of CodeQL have run on a pull request, add them to
  the required checks of the ruleset.

  ```bash
  gh api -X PUT repos/Bimmiest/new-repo/private-vulnerability-reporting
  gh api -X PATCH repos/Bimmiest/new-repo/code-scanning/default-setup -f state=configured
  ```

- **General, Pull requests.** Allow squash merges only. Make the commit messages of the
  branch the default body of a squash commit. Then commit bodies and
  `Upgrade-Note:` lines stay in the history. Delete the
  branch after the merge.

  ```bash
  gh api -X PATCH repos/Bimmiest/new-repo -F allow_merge_commit=false -F allow_rebase_merge=false -F allow_squash_merge=true -f squash_merge_commit_title=COMMIT_OR_PR_TITLE -f squash_merge_commit_message=COMMIT_MESSAGES -F delete_branch_on_merge=true
  ```

- **The token for the settings check.** Create a fine-grained token with
  the repository permission "Administration: read", for this repository.
  One token can cover each repository of the owner. Add it as the
  repository secret `SETTINGS_READ_TOKEN`. The weekly `settings.yml`
  fails without it.

  ```bash
  gh secret set SETTINGS_READ_TOKEN -R Bimmiest/new-repo
  ```

- **A private repository.** On the Free plan, GitHub does not give a
  private repository rulesets, secret scanning, private vulnerability
  reporting or fork approval. Add an exception for each of these settings
  to `.repo-settings.json`, with that reason. In `scorecard.yml`, set
  `publish-results` and `upload-sarif` to `false`, and delete the
  Scorecard badge from the README.

- **Labels.** The process uses `no-issue` and `decision`. The issue forms
  use `bug` and `enhancement`.

  ```bash
  gh label create no-issue --color ededed --description "Too small for an issue; exempt from PR hygiene's issue rules"
  gh label create decision --color 5319e7 --description "An open question; the ADR records the answer"
  ```
