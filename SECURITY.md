# Security policy

## Reporting a vulnerability

Report privately through GitHub's [private vulnerability reporting](https://github.com/Bimmiest/new-repo/security/advisories/new): the **Security** tab, then **Report a vulnerability**. Please do not open a public issue for a security problem.

Expect an acknowledgement within a week. If a report is valid, the fix and the advisory go out together.

## What this application is

<!--
Describe the shape, because the shape decides what the rest of this file can
rule in and out: where it runs, what it stores and where, what it talks to,
whose input it reads. propslab's version says "a static, client-side app with
no backend, no network calls and nothing persisted but a few UI preferences",
and most of a usual policy falls away from that one paragraph.
-->

## In scope

<!--
The paths that render or execute user-controlled input, and the guarantees the
code makes about them. Name the module that makes each guarantee, so a reporter
can read it and a reviewer knows what a bypass looks like.
-->

- **Dependency vulnerabilities** that are reachable from this application's code. CI audits production dependencies on every pull request and weekly.
- **Secrets in the repository or its history.** CI scans the whole history on every pull request and weekly; a hit is rotated, never allowlisted.

## Out of scope

- **Correctness bugs** that are not vulnerabilities. Please file them as normal issues, ideally with a minimal reproduction.
- **Self-XSS** requiring the user to paste content into their own devtools console.
- **Findings against the hosting provider's headers or TLS** that are its configuration rather than this repository's, though a report is still welcome if something looks wrong.

## Supported versions

Fixes land on `main`. There is no support branch for older releases.
