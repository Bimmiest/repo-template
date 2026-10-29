# CLAUDE.md

The conventions are in [CONTRIBUTING.md](./CONTRIBUTING.md). Read it before
your first change. This file does not summarise it. It names the rules that
people break, and the rules where a mistake is expensive and not obvious.

## Before you write code

**Open an issue first** for each change that is larger than a typo. The issue
is where people argue about the reason, while the change is still cheap. A
closed issue is not a substitute: new work gets a new issue.

## Branches

The pattern and the types are in
[CONTRIBUTING](./CONTRIBUTING.md#branches), and CI refuses a pull request
that breaks them. **If your session got a branch name that does not
conform** (for example an automatic `claude/…` name), rename it to a name
that conforms. You have permission to do this, and you must. Open the pull
request again from the renamed branch, and say so in the description. Do not
choose one name silently.

## Gates

Run the gates before you open a pull request.
[docs/development.md](./docs/development.md#run-the-gates) gives the commands.

CI runs the same commands and the shared checks: the documentation checks, PR
hygiene, secrets, Trivy, and the checks of the stack (for `node-ts`: the
coverage ratchet, licences and advisories). When a check fails, it tells you
what to change. Do that. Do not find a way around the check.

## Documentation

- **Write all documentation in ASD-STE100.** [docs/documentation.md](./docs/documentation.md#asd-ste100)
  lists the rules.
- **Put each text in its class.** A rule goes in CONTRIBUTING, in one or two
  sentences. A recipe or a trap goes in the topic file of its area in `docs/`.
  CI holds each class to a line limit ([the classes](./docs/documentation.md#where-each-text-goes)).
- **Keep the README to the fundamentals, in a maximum of 200 lines.** CI
  fails a longer README. Put technical detail in a file in `docs/`, and link
  it from the README.
- **Update the documents that your change makes wrong, in the same change.**
  CI checks only links, the ADR index, the line limits and the topic types. The last
  person who changed the rest of the text keeps it true.

## Code comments

Follow [the rules](./docs/code-style.md#code-comments). A comment says why, for
the code as it is now. For history, link the issue or the ADR. Lint finds code
in a comment, and a TODO that has no issue.

## Expensive to get wrong

- **Do not lower a coverage floor** to make a branch green. When the ratchet
  tells you to raise a floor, raise it in the same change.
- **Do not turn a lint rule off at a call site.** If a rule is wrong for this
  code, turn it off in the lint config, with the sentence that says why.
- **Do not edit an accepted ADR.** Write a new ADR, and mark the old one as
  superseded.
- **Do not put `${{ }}` in a `run:` block.** The text of a pull request and
  the inputs get to a shell through `env:`.

<!--
Add the rules of this repository here when you find them: vendored code that
nobody edits here, generated files and the script that makes them, and
migrations that must apply as an upgrade. Write one line for each rule, with
its reason.
-->

## Not in this file

This file has no status, no plan and no test counts. Status goes in issues.
Keep this file to one screen. A longer file does not get read, and a reader
who acts on half of it does more damage than a reader who reads none.
