import { describe, expect, it } from 'vitest';
import { change, fileChange } from './test-builders.mjs';
import { check, problem } from './uses-pin.mjs';

const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const WORKFLOW = '.github/workflows/ci.yml';

describe('uses-pin', () => {
  it.each([
    [`actions/checkout@${SHA}`, '# v7.0.1'],
    [`owner/repo/.github/workflows/x.yml@${SHA}`, '# v1.11.0'],
    [`owner/repo/path@${SHA}`, '# v1.2.3 # zizmor: ignore[x]'],
    ['./.github/actions/docs-check', '# zizmor: ignore[self-repository]'],
    ['./.github/workflows/mutation.yml', null],
    [`Azure/static-web-apps-deploy@${SHA}`, '# v1 branch, 2024-09-11'],
    [`owner/repo@${SHA}`, '# release/2.x branch, 2026-02-28'],
    [`owner/repo@${SHA}`, '# main branch, 2024-02-29 # zizmor: ignore[x]'],
  ])('passes %s %s', (value, comment) => {
    expect(problem(value, comment)).toBeNull();
  });

  it.each([
    ['actions/checkout@v7', '# v7.0.1'],
    ['actions/checkout@main', null],
    [`actions/checkout@${SHA.slice(0, 39)}`, '# v7.0.1'],
    [`actions/checkout@${SHA.toUpperCase()}`, '# v7.0.1'],
    ['actions/checkout', null],
    ['docker://alpine:3.20', null],
    [`actions/checkout@${SHA}`, null],
    [`actions/checkout@${SHA}`, '# 7.0.1'],
    [`actions/checkout@${SHA}`, '# the head of main, read in September'],
    [`actions/checkout@${SHA}`, '# v1'],
    [`actions/checkout@${SHA}`, '# v1 branch'],
    [`actions/checkout@${SHA}`, '# branch v1, 2024-09-11'],
    [`actions/checkout@${SHA}`, '# v1 branch 2024-09-11'],
    [`actions/checkout@${SHA}`, '# v1 branch, 11-09-2024'],
    [`actions/checkout@${SHA}`, '# v1 branch, 2024-9-11'],
    [`actions/checkout@${SHA}`, '# v1 branch, 2023-02-29'],
    [`actions/checkout@${SHA}`, '# v1 branch, 2024-13-01'],
    [`actions/checkout@${SHA}`, '# branch, 2024-09-11'],
    ['Azure/static-web-apps-deploy@v1', '# v1 branch, 2024-09-11'],
    ['Azure/static-web-apps-deploy', '# v1 branch, 2024-09-11'],
  ])('fails %s %s', (value, comment) => {
    expect(problem(value, comment)).not.toBeNull();
  });

  it('gives the file and the line of each finding', () => {
    const after = `jobs:\n  a:\n    uses: o/r/.github/workflows/x.yml@main\n  b:\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n      - uses: actions/cache@v4`;
    const found = check(change([fileChange(WORKFLOW, { before: '', after })]));
    expect(found.map(({ rule, file, line }) => ({ rule, file, line }))).toEqual([
      { rule: 'uses-pin', file: WORKFLOW, line: 3 },
      { rule: 'uses-pin', file: WORKFLOW, line: 7 },
    ]);
  });

  it('passes the branch form in a workflow, as a consumer writes it (#73)', () => {
    const after = [
      'jobs:',
      '  deploy:',
      '    steps:',
      '      - name: Deploy',
      '        uses: Azure/static-web-apps-deploy@4d27395796ac319302594769cfe812bd207490b1 # v1 branch, 2024-09-11',
      `      - uses: actions/checkout@${SHA} # latest`,
    ].join('\n');
    const found = check(change([fileChange(WORKFLOW, { before: '', after })]));
    expect(found.map(({ line }) => line)).toEqual([6]);
  });

  it('reads only workflow and action files, and not a deleted one', () => {
    const text = 'steps:\n  - uses: actions/checkout@v7';
    expect(check(change([fileChange('docs/x.yml', { after: text }), fileChange(WORKFLOW, { before: text })]))).toEqual(
      [],
    );
  });
});
