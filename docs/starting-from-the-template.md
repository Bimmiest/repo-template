# Starting from the template

This template holds the conventions, gates and governance files from
[`propslab`](https://github.com/Bimmiest/propslab) and
[`propslab-ent`](https://github.com/Bimmiest/propslab-ent). The code in
`src/` is a placeholder. Keep everything else. The checks run from
[`shared-workflows`](https://github.com/Bimmiest/shared-workflows), pinned by
commit.

Do these steps in order. When you finish the last step, delete this file and
the note at the top of the README.

## Steps

1. **Create the repository** from the template, then clone it.

   ```bash
   gh repo create Bimmiest/<name> --template Bimmiest/repo-template --public --clone
   ```

2. **Rename.** Each `new-repo` is the placeholder for the name of the
   repository. Replace each one. This command finds them:

   ```bash
   grep -rl new-repo . --exclude-dir=node_modules --exclude-dir=.git
   ```

   The files are `package.json` (`name` and `repository.url`),
   `SECURITY.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/config.yml`, the
   README and its banner in `docs/assets/banner.svg`. After this step, the
   README badges show the status of the new repository.

3. **Install, and run the gates.** The lockfile is in the repository, and
   `npm ci` installs exactly what it records.

   ```bash
   nvm use   # .nvmrc is exact, and .npmrc holds npm to engines
   npm ci
   npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build
   ```

4. **Replace `src/`** with the first real module and its test. Then run
   `npm run test:coverage`. Write the measured figures, rounded down, into
   the `thresholds` of `vitest.config.ts`, and write the date on the
   "Measured on" line. This is the only time that the floors go down. After
   this step, they only go up.

5. **Set the repository settings.** A template copies files, not settings.
   Thus you must set each of these again on each repository that you make
   from the template.

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
     echo '{"enabled":true,"allowed_actions":"all","sha_pinning_required":true}' | gh api -X PUT repos/Bimmiest/<name>/actions/permissions --input -
     gh api -X PUT repos/Bimmiest/<name>/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
     gh api -X PUT repos/Bimmiest/<name>/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
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
     gh api -X PUT repos/Bimmiest/<name>/private-vulnerability-reporting
     gh api -X PATCH repos/Bimmiest/<name>/code-scanning/default-setup -f state=configured
     ```

   - **General, Pull requests.** Allow squash merges only. Make the commit messages of the
     branch the default body of a squash commit. Then commit bodies and
     `Upgrade-Note:` lines stay in the history. Delete the
     branch after the merge.

     ```bash
     gh api -X PATCH repos/Bimmiest/<name> -F allow_merge_commit=false -F allow_rebase_merge=false -F allow_squash_merge=true -f squash_merge_commit_title=COMMIT_OR_PR_TITLE -f squash_merge_commit_message=COMMIT_MESSAGES -F delete_branch_on_merge=true
     ```

   - **The token for the settings check.** Create a fine-grained token with
     the repository permission "Administration: read", for this repository.
     One token can cover each repository of the owner. Add it as the
     repository secret `SETTINGS_READ_TOKEN`. The weekly `settings.yml`
     fails without it.

     ```bash
     gh secret set SETTINGS_READ_TOKEN -R Bimmiest/<name>
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

6. **Write the README.** Replace each placeholder, and add a demo. Keep the
   README to the fundamentals, in ASD-STE100, and within 200 lines
   (CONTRIBUTING, "Documentation"). Then delete this file and the note at
   the top of the README, and open the first pull request.

## What each file is for

This table names only the files whose purpose the name does not make clear.

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | The gates on each pull request and each push to `main`, and a weekly randomised run of the suite |
| `.github/workflows/security.yml` | gitleaks and Trivy, weekly and on each change. They have a workflow of their own, so that a red run tells you which kind of problem it found. |
| `.github/workflows/pr-hygiene.yml` | The branch and issue convention, enforced |
| `.github/workflows/supply-chain.yml` | A monthly comparison of `.nvmrc` with the newest patch of its Node line |
| `.github/workflows/scorecard.yml` | OpenSSF Scorecard, weekly and on `main`, for the README badge and code scanning |
| `.github/workflows/settings.yml` | A weekly comparison of the repository settings with this checklist. A failure opens an issue. |
| `.github/dependabot.yml` | Weekly updates, grouped, with a cooldown. Each ignore has its reason. |
| `.audit-exceptions.json`, `.licence-allowlist.json`, `.gitleaks.toml`, `.trivyignore.yaml` | The files that the shared checks read. Each file tells you what an entry needs. |
| `.docs-check.json` | The settings of the shared docs check: the line limit of the README, and the files that the STE word check reads |
| `.repo-settings.json` | The required checks of `main`, and the exceptions to this checklist, each with its reason |
| `.git-blame-ignore-revs` | The commits that only change formatting, so that `git blame` ignores them |
| `.npmrc`, `.nvmrc` | One exact Node version, which npm holds you to |
| `docs/adr/` | The decisions, with an index that CI holds to the directory |
| `docs/assets/` | The banner and the demo that the README shows |
| `CLAUDE.md` | One screen for an agent: the rules that people break |
