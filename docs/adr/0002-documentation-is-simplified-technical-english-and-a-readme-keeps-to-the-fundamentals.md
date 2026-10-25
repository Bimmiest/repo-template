# 0002. Documentation is Simplified Technical English, and a README keeps to the fundamentals

- **Status:** Accepted
- **Date:** 2026-10-25
- **Issue:** #8

## Context

The READMEs of the repositories that this template comes from grew to
between 350 and 880 lines. They mixed the fundamentals (what the product is,
how to install and use it) with detail for contributors and operators. A
first-time reader had to read all of it to find the fundamentals. Long
sentences, ambiguous modal verbs and mixed terms made the text harder to
translate and to apply.

On 2026-10-25 the owner set a standard for all repositories:

- Documentation is written in ASD-STE100 Simplified Technical English.
- A README keeps to the fundamentals, in a fixed shape
  ([banesullivan/README](https://github.com/banesullivan/README)), with a
  banner, badges and a demo.
- Technical detail goes in its own file, not in the README and not in a
  wiki.

## Decision

- **All documentation is written in ASD-STE100.** This applies to each new
  or changed text. It does not apply to an accepted ADR, which does not
  change, or to third-party text. CONTRIBUTING lists the main rules.
- **A README has a maximum of 200 lines**, in the sections that CONTRIBUTING
  lists. The shared docs check enforces the limit through
  `"readmeMaxLines": 200` in `.docs-check.json` (shared-workflows 1.1.0).
- **Technical detail goes in `docs/*.md`**, and the Documentation table of
  the README links each file. A wiki is not used. A wiki change gets no
  review and no link check. Also, GitHub does not give a wiki to a private
  repository on the Free plan.

## Consequences

- A new reader finds the fundamentals in one screen or two. A contributor
  finds the detail one link away, in a file that has the same review and
  link check as the code.
- A README that grows past 200 lines fails CI. The fix is to move a topic to
  `docs/`, not to raise the limit. A repository that needs a different limit
  records the reason in an ADR of its own.
- STE has a cost: some text gets longer, because STE prefers short sentences
  and lists. The 200-line limit applies to the README only, so the cost
  falls on files in `docs/`.
- The rule applies to new and changed text. Old text changes to STE when
  somebody next edits it, so there is no single large rewrite.
- propslab, propslab-sb and propslab-ent apply the same standard in changes
  of their own.
