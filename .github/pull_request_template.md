<!--
Delete any section that genuinely does not apply. An empty heading left behind
is worse than no heading.
-->

## What and why

<!--
What changed, and the reasoning, including what it cost. A description that
only lists benefits is marketing. If a trade-off was made, name the thing that
got worse.
-->

Closes #

## Decisions

<!--
Did this settle something that outlives the pull request: a shape, a boundary,
a rule about who may do what? Then it belongs in `docs/adr/` as its own record
with a row in the index, and this section links to it.

ADRs are immutable. A superseded decision gets a new ADR and a status change
on the old one, never an edit.

Delete this section if nothing was decided.
-->

## Verification

<!--
What you ran, and what it said. "Tests pass" is a claim; the output is the
evidence. Paste the interesting lines.
-->

- [ ] `npm run lint` and `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`, and the floor in `vitest.config.ts` was raised if the ratchet asks
- [ ] `npm run build`
- [ ] Documentation this change dates is updated in this change: `CHANGELOG.md` under `Unreleased` for anything a user would notice, the README where a capability changed shape, an ADR and its index row where something was decided, an `Upgrade-Note:` line in the commit where an operator must act ([CONTRIBUTING](../CONTRIBUTING.md#documentation))

## Not done

<!--
What a reader might reasonably assume is here and is not: scope deliberately
left out, limits that still stand, gaps you know about. Say it here rather than
letting someone discover it. A permanent limit belongs in the README under
"What this is not" as well.
-->
