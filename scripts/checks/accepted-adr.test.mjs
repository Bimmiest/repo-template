import { describe, expect, it } from 'vitest';
import { check, isAccepted } from './accepted-adr.mjs';
import { change, fileChange } from './test-builders.mjs';

const PATH = 'docs/adr/0003-a-decision.md';

/** An ADR with the status `status`, and a decision `decision`. */
const adr = (status, decision = 'The code does this.') =>
  `# 0003. A decision\n\n- **Status:** ${status}\n- **Date:** 2026-11-11\n- **Issue:** #1\n\n## Decision\n\n${decision}\n`;

const findings = (path, sides) =>
  check(change([fileChange(path, sides)])).map(({ rule, file, line }) => ({ rule, file, line }));

describe('accepted-adr', () => {
  it.each([
    ['an edit of the decision', { before: adr('Accepted'), after: adr('Accepted', 'The code does that.') }, 9],
    ['an edit of the date', { before: adr('Accepted'), after: adr('Accepted').replace('2026-11-11', '2026-11-12') }, 4],
    ['a deletion', { before: adr('Accepted') }, 1],
    ['a status that names no successor', { before: adr('Accepted'), after: adr('Withdrawn') }, 3],
    [
      'a supersession with an edit',
      { before: adr('Accepted'), after: adr('Superseded by [0007](0007-x.md)', 'New text.') },
      9,
    ],
    [
      'an edit of a partly superseded ADR',
      {
        before: adr('Accepted. Part is superseded by [0005](0005-x.md).'),
        after: adr('Accepted. Part is superseded by [0005](0005-x.md).', 'x'),
      },
      9,
    ],
  ])('fails %s', (_, sides, line) => {
    expect(findings(PATH, sides)).toEqual([{ rule: 'accepted-adr', file: PATH, line }]);
  });

  it.each([
    ['a new ADR', { after: adr('Accepted') }],
    ['an edit of a proposed ADR', { before: adr('Proposed'), after: adr('Accepted', 'Other text.') }],
    ['a supersession', { before: adr('Accepted'), after: adr('Superseded by [0007](0007-x.md)') }],
    [
      'a partial supersession',
      { before: adr('Accepted'), after: adr('Accepted. The bullets are superseded by [0004](0004-x.md).') },
    ],
    [
      'a supersession that wraps the Status item',
      { before: adr('Accepted'), after: adr('Accepted. The coverage bullets are\n  superseded by [0004](0004-x.md).') },
    ],
    ['no change', { before: adr('Accepted'), after: adr('Accepted') }],
  ])('passes %s', (_, sides) => {
    expect(findings(PATH, sides)).toEqual([]);
  });

  it.each(['docs/adr/README.md', 'docs/0003-x.md', 'packages/a/docs/adr/0003-x.md'])('does not read %s', (path) => {
    expect(findings(path, { before: adr('Accepted'), after: adr('Accepted', 'x') })).toEqual([]);
  });

  it('fails an accepted ADR that loses its Status line', () => {
    expect(findings(PATH, { before: adr('Accepted'), after: '# 0003. A decision\n' })).toHaveLength(1);
  });

  it.each([
    ['- **Status:** Accepted', true],
    ['Status: Accepted, refined by [0009](0009-x.md)', true],
    ['* Status: accepted', true],
    ['- **Status:** Proposed', false],
    ['- **Status:** Superseded by [0002](0002-x.md)', false],
    ['No status here.', false],
  ])('reads %j as accepted: %s', (line, accepted) => {
    expect(isAccepted(`# 0001. X\n\n${line}\n`)).toBe(accepted);
  });
});
