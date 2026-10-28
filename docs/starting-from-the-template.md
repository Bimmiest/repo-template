---
type: how-to
---

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
   `SECURITY.md`, `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/config.yml`,
   `docs/repository-settings.md`, the README and its banner in
   `docs/assets/banner.svg`. After this step, the
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
   Do each step in [Repository settings](repository-settings.md). Keep that
   file when you delete this file. `settings.yml` compares the settings with
   it each week.

6. **Write the README.** Replace each placeholder, and add a demo. Keep the
   README to the fundamentals, in ASD-STE100, and within 200 lines
   ([documentation.md](documentation.md#the-readme)). Then delete this file and the note at
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
| `.github/workflows/settings.yml` | A weekly comparison of the repository settings with the checklist in `docs/repository-settings.md`. A failure opens an issue. |
| `.github/dependabot.yml` | Weekly updates, grouped, with a cooldown. Each ignore has its reason. |
| `.audit-exceptions.json`, `.licence-allowlist.json`, `.gitleaks.toml`, `.trivyignore.yaml` | The files that the shared checks read. Each file tells you what an entry needs. |
| `.docs-check.json` | The settings of the shared docs check: the line limit of the README, and the files that the STE word check reads |
| `.repo-settings.json` | The required checks of `main`, and the exceptions to the settings checklist, each with its reason |
| `.git-blame-ignore-revs` | The commits that only change formatting, so that `git blame` ignores them |
| `.npmrc`, `.nvmrc` | One exact Node version, which npm holds you to |
| `docs/adr/` | The decisions, with an index that CI holds to the directory |
| `docs/assets/` | The banner and the demo that the README shows |
| `CLAUDE.md` | One screen for an agent: the rules that people break |
