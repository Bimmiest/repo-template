<!--
Delete each section that does not apply. An empty heading is worse than no
heading.
-->

## What and why

<!--
Say what changed and why, and what it cost. A description that lists only
benefits is marketing. If you made a trade-off, name the thing that got
worse.
-->

Closes #

## Decisions

<!--
Did this change settle something that stays true after the merge: a shape, a
boundary, or a rule about who can do what? Then it goes in `docs/adr/` as a
record of its own, with a row in the index, and this section links to it.

An ADR does not change. When a decision changes, write a new ADR and change
the status of the old one. Do not edit the old one.

Delete this section if the change made no decision.
-->

## Verification

<!--
Say what you ran, and what it said. "Tests pass" is a claim. The output is
the evidence. Paste the important lines.
-->

- [ ] `npm run lint` and `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`, and the floor in `vitest.config.ts` is raised if the ratchet asks
- [ ] `npm run build`
- [ ] The documents that this change makes wrong are updated in this change, in ASD-STE100 ([CONTRIBUTING](../CONTRIBUTING.md#documentation)):
  - `CHANGELOG.md`, under `Unreleased`, for a change that a user can see
  - The README, or a file in `docs/`, where a capability changed shape
  - An ADR and its index row, where a decision was made
  - An `Upgrade-Note:` line in the commit, where an operator must act

## Not done

<!--
Say what a reader can expect to find here that is not here: scope that you
left out on purpose, limits that are still true, and gaps that you know
about. Say it here, so that nobody finds it later by surprise. A permanent
limit also goes in the Overview of the README, under what the product is
not.
-->
