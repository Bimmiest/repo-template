---
type: reference
---

# The baseline standard

This is the minimum that each repository on GitHub and on Forgejo must have,
and what each new repository starts with (estate ADR 0016). It is the same on
each forge, and for each language. A repository takes the core set, and the
layer of each stack that it has. The last section lists what is different on
each forge.

This template is the core set, the GitHub wiring and the `node-ts` layer. The
Forgejo template has the same core files, with the Forgejo wiring. Each week, a
job on Forgejo compares its core files with the files here, at a recorded SHA.

## The core set

Each repository has all of the core set, whatever its stack.

### Files

| Item | File | Rule |
|---|---|---|
| Entry | `README.md` | The fundamentals, in 200 lines or fewer |
| Contribution rules | `CONTRIBUTING.md` | The rules only, in 300 lines or fewer |
| Agent rules | `CLAUDE.md` | 80 lines or fewer. An `AGENTS.md` is a one-line pointer to it |
| Security policy | `SECURITY.md` | How to report a vulnerability |
| Licence | `LICENSE` | Only in a public repository |
| Release record | `CHANGELOG.md`, or one line in the README | See [Releases](#releases) |
| Decision index | `docs/adr/README.md` | One row for each record in `docs/adr/` |
| Pull request template | `pull_request_template.md` | In the forge folder |
| Issue forms | `ISSUE_TEMPLATE/` | Bug, enhancement, decision and tech debt, each with its label. In the forge folder |
| Code owners | `CODEOWNERS` | In the forge folder |

The forge folder is `.github/` on GitHub and `.forgejo/` on Forgejo. The line
limits and the classes of each file are in [documentation.md](documentation.md).

### Checks

| Check | When it runs | It fails when |
|---|---|---|
| Secret scan | Each pull request, each push to `main`, and each week | gitleaks finds a secret. A pull request scans its own commits. The other runs scan the full history, because a removed secret is still in each clone |
| File scan | Each pull request, each push to `main`, and each week | `trivy fs` finds a secret or a misconfiguration at `HIGH` or `CRITICAL`, or a vulnerability that has a fixed version |
| Workflow lint | Each pull request | actionlint or zizmor finds a problem in a workflow |
| Docs check | Each pull request | A relative link does not resolve, the ADR index does not agree with the records, or a file is over its line limit |
| PR hygiene | Each pull request | The branch name or the issue link breaks the rule in [Branches](#branches) |
| Settings check | Each week | The merge settings or the protection of `main` are not as [Merging](#merging) says |

A weekly check that fails must tell a person. It opens or updates an issue, or
it posts to the alerts channel. A red run that nobody sees is not a check.

### Workflow hygiene

- Each job has `timeout-minutes`.
- Each action is pinned to a commit SHA, with its version in a comment:
  `@<sha> # vX.Y.Z`.
- Each container image is pinned as `<image>:<tag>@sha256:<digest>`.
- Each checkout sets `persist-credentials: false`.

The update bot can bump a pin only in these two forms. A SHA with no version
comment, or a digest with no tag, stays where it is until a person moves it.

### Updates

An update bot opens a pull request for each version bump:

- It holds back a new version for 7 days. A security fix is not held back.
- Minor and patch updates land as one pull request. A major update arrives
  alone, because a major update is where a fix can be a regression.
- All workflow-action updates land as one pull request.
- Nothing merges by itself, except the exceptions that estate ADR 0019 names.

### Merging

- Each repository merges by squash only. The squash body is the commit
  messages of the branch, and the branch is deleted on merge (estate ADR 0017).
  So the commit bodies are the record on `main`.
- `main` is protected. A change arrives by pull request, and the required
  checks must pass. Nobody can bypass the protection.

### Branches

A branch is `<type>/<short-description>-<issue-number>`. The type is one of
`feature`, `fix`, `refactor`, `docs`, `ci` and `chore` (estate ADR 0022). The
pull request links an issue in the same repository: an issue in a different
repository does not count. A change that is too small for an issue gets the
`no-issue` label.

A branch that a tool names gets no type. Its author is exempt instead, as
`dependabot[bot]` is on GitHub.

### Releases

A repository is tagged when somebody picks a version of it: another
repository pins it, or it ships releases to the people who run it. It keeps a
`CHANGELOG.md`, and each release is a `vX.Y.Z` tag.

For each other repository, the commit SHA is the release. What is live is the
commit that `main` is at, or the digest of the image. Its README says so in
one line, and has no `CHANGELOG.md` (estate ADR 0024).

## The stack layers

A repository takes the layer of each stack that it has. A `container-image`,
`gitops-config` or `docs-only` repository takes the core set and its stack
layer, but not the documentation layer (estate ADR 0021).

### Documentation

For the `node-ts`, `rust` and `opentofu-ansible` stacks:

- The six topic files in `docs/`: `development.md`, `ci.md`, `testing.md`,
  `code-style.md`, `dependencies.md` and `documentation.md`.
- A `type:` in the frontmatter of each topic file, and a row for each topic
  file in `docs/README.md`.
- The ASD-STE100 rules, which the docs check gives as warnings.

[documentation.md](documentation.md) has the detail.

### `node-ts`

This template has the full layer:

- `.nvmrc` pins the Node version, and CI reads it. A check fails on a
  schedule when the pin is not the newest patch of its Node line.
- TypeScript in strict mode, ESLint with `strictTypeChecked`, and Prettier.
- vitest, with a line-coverage floor that only goes up.
- An audit of the production dependencies, with an exceptions file that
  expires, and a licence check against an allowlist.

### `rust`

- `cargo fmt --check`, `cargo clippy` with warnings as errors, and
  `cargo test`.
- `cargo deny` for advisories and licences.
- A line-coverage floor (`cargo llvm-cov`) that only goes up.

### `opentofu-ansible`

- A pull request runs the plan and the Ansible check, and posts the output as
  a comment. A merge to `main` applies them. Nobody applies outside this path.
- `tofu fmt -check -recursive` and `tofu validate` must pass, and
  `.terraform.lock.hcl` is committed.
- ansible-lint and shellcheck fail the job. A finding is not only a warning.
- Each week, a drift check compares the live state with `main`, and a
  scheduled apply applies `main` again (estate ADR 0019). A repository whose
  bad apply can strand its own runner applies only by hand.

### `container-image`

- A pull request builds the image and validates it, and does not push it.
- The image is scanned before it is pushed.
- The base image is pinned by digest, and the image is rebuilt each week.

### `gitops-config`

- `main` is protected, and a validation job for the config is a required
  check (estate ADR 0018). A merge deploys at once.
- The host validates or health-checks each sync, and rolls back a bad one.

### `docs-only`

- The docs check and the index checks. There are no code gates.

## What is different on each forge

| | GitHub | Forgejo |
|---|---|---|
| Forge folder | `.github/` | `.forgejo/` |
| Shared CI | The reusable workflows and the composite actions of Bimmiest/shared-workflows | The composite actions of the shared actions repository on the instance, for the scans and the workflow lint. The shared-workflows actions run without change, from github.com |
| Action reference | `owner/repo/path@<sha> # vX.Y.Z` | An absolute URL: `https://github.com/owner/repo/path@<sha> # vX.Y.Z`, or the URL of the action on the instance |
| Update bot | Dependabot | Renovate, self-hosted, with a shared preset. A repository opts in with a `renovate.json` |
| Authors that PR hygiene exempts | `dependabot[bot]` | The Renovate account, and the service account of the platform |
| `permissions:` in a workflow | The least access that each job needs | Leave it out. Forgejo ignores it, so it tells a reader something that is not true |
| Merge settings and branch protection | Set on the repository, and checked each week by `settings.yml` | Set as code, in the repository that holds the forge settings |
| Licence | Each public repository | None. The Forgejo repositories are private |
| CI image | The runner image | A CI image from the registry of the instance, pinned by digest |
