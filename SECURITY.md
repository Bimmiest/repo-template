# Security policy

## How to report a vulnerability

Report it privately through the
[private vulnerability reporting](https://github.com/Bimmiest/new-repo/security/advisories/new)
of GitHub: open the **Security** tab, then select **Report a vulnerability**.
Do not open a public issue for a security problem.

You get an acknowledgement within a week. If the report is valid, the fix
and the advisory are published together.

## What this application is

<!--
Describe the shape of the application, because the shape decides what the
rest of this file can include and exclude: where it runs, what it stores and
where, what it connects to, and whose input it reads. The propslab version
says "a static, client-side app with no backend, no network calls and nothing
persisted but a few UI preferences". That one paragraph removes most of a
usual policy.
-->

## In scope

<!--
List the paths that show or run input that a user controls, and the
guarantees that the code makes about them. Name the module that makes each
guarantee. Then a reporter can read the module, and a reviewer knows what a
bypass looks like.
-->

- **Vulnerabilities in dependencies** that the code of this application can
  reach. CI audits the production dependencies on each pull request and each
  week.
- **Secrets in the repository or its history.** CI scans the full history on
  each pull request and each week. A secret that CI finds is rotated, not
  allowlisted.

## Out of scope

- **Correctness bugs** that are not vulnerabilities. Report them as usual
  issues, with a minimal reproduction if you can.
- **Self-XSS**, where the user must paste content into the console of their
  own browser tools.
- **Findings about the headers or TLS of the hosting provider**, when they
  come from the configuration of the provider and not of this repository. If
  something looks wrong, a report is still welcome.

## Supported versions

Fixes go to `main`. There is no support branch for older releases.
