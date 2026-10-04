# new-repo

<!--
This README is in two halves. The first, "Starting from the template", is a
checklist for the person creating a repository from repo-template; delete it
when every item is done. The second is the README the new repository keeps.
-->

## Starting from the template

The conventions, gates and governance files from [`propslab`](https://github.com/Bimmiest/propslab) and [`propslab-ent`](https://github.com/Bimmiest/SplunkToolkit-Ent), ready to start from. The code in `src/` is a placeholder; everything else is meant to survive. The checks run from [`shared-workflows`](https://github.com/Bimmiest/shared-workflows), pinned by commit.

1. **Create the repository** from the template, then clone it.

   ```bash
   gh repo create Bimmiest/<name> --template Bimmiest/repo-template --public --clone
   ```

2. **Rename.** Every `new-repo` is the placeholder for the repository's name:

   ```bash
   grep -rl new-repo . --exclude-dir=node_modules --exclude-dir=.git
   ```

   `package.json` (`name`, `repository.url`), `SECURITY.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/config.yml`, and this file.

3. **Install and run the gates.** The lockfile is committed; `npm ci` installs exactly it.

   ```bash
   nvm use   # or any Node 24; .nvmrc is exact and .npmrc holds npm to engines
   npm ci
   npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build
   ```

4. **Replace `src/`** with the first real module and its test. Then run `npm run test:coverage` and write what it measures into `vitest.config.ts`'s `thresholds`, rounded down, with the date on the "Measured on" line. This is the one time the floors move down; from here they only ratchet up.

5. **Repository settings** that are not files. A template copies files, not settings, so each of these is set again on every repository created from it.
   - **Actions → General**: workflow permissions read-only and no creating or approving pull requests; approval required for workflows from **all** external contributors' forks; **require actions to be pinned to a full-length commit SHA** (every `uses:` here already is, and GitHub accepts a same-repository `./` reference under it). "Allow all actions" is acceptable because of that pin requirement; the stricter allowlist, if wanted, is `actions/*`, `github/*`, `Bimmiest/*`, `gitleaks/gitleaks-action@*`, `aquasecurity/trivy-action@*` and `zizmorcore/zizmor-action@*`.

     ```bash
     echo '{"enabled":true,"allowed_actions":"all","sha_pinning_required":true}' | gh api -X PUT repos/Bimmiest/<name>/actions/permissions --input -
     gh api -X PUT repos/Bimmiest/<name>/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
     gh api -X PUT repos/Bimmiest/<name>/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
     ```

   - **Branches → `main`**: require a pull request; require the status checks `verify`, `audit`, `workflow-lint / workflow-lint`, `pr-hygiene`, `security / gitleaks` and `security / trivy` by name; block force-push and deletion. Add `dependency-review` once the dependency graph is on. A check has to have run once before GitHub offers it by name, so open the first pull request first.
   - **Security**: enable private vulnerability reporting, Dependabot alerts and the dependency graph.
   - **General → Pull requests**: squash merging only; default the squash message to the pull request title and description.
   - **Labels**: `no-issue` and `decision` are used by the process; `bug` and `enhancement` by the issue forms.

     ```bash
     gh label create no-issue --color ededed --description "Too small for an issue; exempt from PR hygiene's issue rules"
     gh label create decision --color 5319e7 --description "An open question; the ADR records the answer"
     ```

6. **Write the README below**, delete this section, and open the first pull request.

What a file is for, when it is not obvious from its name:

| File | Why it is here |
|---|---|
| `.github/workflows/ci.yml` | the gates on every pull request and push to `main`, plus a weekly randomised run of the suite |
| `.github/workflows/security.yml` | gitleaks and Trivy, weekly and on every change, in a workflow of their own so a red run says which kind of thing broke |
| `.github/workflows/pr-hygiene.yml` | the branch and issue convention, enforced |
| `.github/workflows/supply-chain.yml` | `.nvmrc` against the newest Node patch, monthly |
| `.github/dependabot.yml` | weekly updates, grouped, with a cooldown; every ignore has its reason |
| `.audit-exceptions.json`, `.licence-allowlist.json`, `.gitleaks.toml`, `.trivyignore.yaml` | the files the shared checks read; each explains itself and what an entry needs |
| `.git-blame-ignore-revs` | reformat-only commits, so blame looks through them |
| `.npmrc`, `.nvmrc` | one exact Node, held to by npm |
| `docs/adr/` | decisions, with an index CI holds to the directory |
| `CLAUDE.md` | one screen for an agent: the rules that get broken |

---

## What it does

<!-- One paragraph. What a user gets, in their terms. -->

## How mature it is

<!-- Pre-release, or a version. The caveats a user should know before relying on it. Delete a caveat in the change that removes it. -->

## Running it locally

```bash
nvm use
npm ci
npm run dev        # if there is one; otherwise `npm run build && node dist/index.js`
```

See [CONTRIBUTING](CONTRIBUTING.md) for the gates to run before a pull request.

## Documentation

| Document | What it holds |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | how work happens here: branches, commits, tests, style, dependencies, releases |
| [docs/adr/](docs/adr/README.md) | the decisions and why |
| [CHANGELOG.md](CHANGELOG.md) | what changed for a user, newest first |
| [SECURITY.md](SECURITY.md) | how to report a vulnerability, and what is in scope |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | the Contributor Covenant, enforced through the security contact |

## What this is not

<!-- The limits that are permanent rather than pending. A reader finds them here rather than discovering them. -->

## Licence

[MIT](LICENSE). <!-- Add a row per `LICENSE-*` file for third-party material redistributed here: what it covers and what it obliges. CI's docs-check fails if one is missing. -->
