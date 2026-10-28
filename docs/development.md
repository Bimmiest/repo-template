---
type: how-to
---

# Development

How to set up a checkout, run the gates, record tech debt, and find the cause
of a failure. The rules are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Set up

1. Install the Node version in `.nvmrc`: `nvm install`.
2. Install the dependencies: `npm ci`.

`engine-strict=true` in `.npmrc` refuses a different Node version. If
`npm ci` stops with an engine error, run `nvm use` and try again.

## Run the gates

Run the five gates before you open a pull request. CI runs the same commands.

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build
```

To run one test file, use `npx vitest run src/path/to/file.test.ts`. To run
the tests that have a name, use `npx vitest run -t "part of the name"`.

To run a shared check locally, clone `shared-workflows` next to this
repository, and run its script from here:

```bash
node ../shared-workflows/.github/actions/docs-check/docs-check.mjs
```

## Tech debt

Tech debt is work that operates now but must change later. An issue with the
label `tech-debt` records it, so that people can plan it. A bug is different:
the code does not do what it must. An enhancement is different: it adds
behaviour.

Open the issue, with the form **Tech debt**, in the pull request that makes
the compromise. These are the usual causes:

- **You hold a version back.** An `ignore` entry in `.github/dependabot.yml`
  that holds a version until something changes names the issue. An entry
  that records a permanent rule, for example two packages that always move
  together, gives its reason and needs no issue.
- **A version move needs more than a bump.** A Dependabot pull request that
  cannot pass alone, for example a major that needs a migration, gets an
  issue that says what the move needs. Link the pull request from the issue.
- **A workaround waits for a fix in a different project**, for example a bug
  in a dependency, or a feature that the forge does not have. The comment at
  the workaround names the issue: `TODO(#123): what is not done.`

Before you open an issue, search the open `tech-debt` issues. One cause has
one issue, so two holds that the same migration removes share an issue.

Pay the debt in a change that touches its code, or plan it as other work.
The pull request that removes the hold or the workaround closes the issue. It
also removes the `ignore` entry or the comment.

## Traps

Add a trap here when it costs a contributor time and a check cannot find it.
Give the symptom first, then the cause, then the fix. If a trap belongs to an
area, put it in the topic file of that area: [ci.md](ci.md),
[testing.md](testing.md), [code-style.md](code-style.md),
[dependencies.md](dependencies.md) or [documentation.md](documentation.md).
