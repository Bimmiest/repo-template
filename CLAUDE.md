# CLAUDE.md

Conventions live in [CONTRIBUTING.md](./CONTRIBUTING.md); read it before the
first change. This file does not summarise it. It names the rules that get
broken, and the ones where a mistake is expensive and non-obvious.

## Before writing code

**Open an issue first**, for anything larger than a typo. The issue is where
the *why* gets argued while changing it is still cheap. A closed issue is not a
substitute: if the work is new, the issue is new.

## Branches

The pattern and the type list are in [CONTRIBUTING](./CONTRIBUTING.md#branches),
and CI refuses a pull request that breaks them. **If your session was assigned
a non-conforming branch**, an automated `claude/…` name, say, you have standing
permission to rename it to a conforming one, and should; reopen the pull
request from it and say so in the description. Never resolve the conflict
silently in either direction.

## Gates

Five commands, locally, before opening a pull request:

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build
```

CI runs the same five plus the shared checks (coverage ratchet, licences,
advisories, docs links and the ADR index, PR hygiene, secrets, Trivy). When one
of those fails it prints what to change; do that, rather than working around
it.

## Documentation

**Update what your change dates, in the change that dates it.** CONTRIBUTING
says [which document, and when](./CONTRIBUTING.md#documentation). Only the
links and the ADR index are enforced; the rest is as true as the last person
who touched it made it.

## Expensive to get wrong

- **Never lower a coverage floor** to make a branch green. Raise it when the
  ratchet says so, in the same change.
- **Never `eslint-disable` at a call site.** A rule that is wrong for this
  codebase is turned off in `eslint.config.js` with the sentence saying why.
- **Never edit an accepted ADR.** Write a new one and mark the old one
  superseded.
- **Never paste `${{ }}` into a `run:` block.** Pull request text and inputs
  reach a shell through `env:`.

<!-- Add this repository's own here as they are found: vendored code that is
never edited locally, generated files and the script that regenerates them,
migrations that must apply as an upgrade. One line each, with the reason. -->

## Not in this file

No implementation status, no roadmap, no test counts. Status belongs in issues.
Keep this to one screen; past that it stops being read, and acting on half of
it is worse than reading none.
