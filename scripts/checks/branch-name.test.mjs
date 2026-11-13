import { describe, expect, it } from 'vitest';
import { check } from './branch-name.mjs';
import { change } from './test-builders.mjs';

// The pattern of PR hygiene comes from shared-workflows at run time. This
// stands in for it: the plumbing is under test here, not the pattern.
const PATTERN = /^(feature|fix)\/[a-z0-9][a-z0-9-]*(-[0-9]+)?$/;

const findings = (branch, branchPattern = PATTERN) => check(change([], { branch, branchPattern })).map((f) => f.rule);

describe('branch-name', () => {
  it.each(['claude/issues-priority-plan-7jxx5e', 'Feature/x-1', 'feature/Upper-1'])('fails %s', (branch) => {
    expect(findings(branch)).toEqual(['branch-name']);
  });

  it.each(['feature/claude-md-check-scripts-47', 'fix/a-typo', 'main'])('passes %s', (branch) => {
    expect(findings(branch)).toEqual([]);
  });

  it('passes a detached HEAD, and a run with no pattern', () => {
    expect(findings(null)).toEqual([]);
    expect(findings('claude/x', null)).toEqual([]);
  });
});
