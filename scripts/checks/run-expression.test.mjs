import { describe, expect, it } from 'vitest';
import { check } from './run-expression.mjs';
import { change, fileChange } from './test-builders.mjs';

const WORKFLOW = '.github/workflows/ci.yml';
const findings = (path, after) =>
  check(change([fileChange(path, { before: '', after })])).map(({ rule, file, line }) => ({ rule, file, line }));

describe('run-expression', () => {
  it.each([
    ['a plain run', 'steps:\n  - run: echo ${{ github.head_ref }}', [2]],
    [
      'each line of a block run',
      'steps:\n  - run: |\n      echo ok\n      echo ${{ inputs.a }}\n      echo ${{ inputs.b }}',
      [4, 5],
    ],
    ['a run in a shell comment', 'steps:\n  - run: |\n      # ${{ secrets.X }}\n      true', [3]],
    [
      'a composite action',
      'runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo ${{ inputs.x }}',
      [5],
    ],
  ])('fails %s', (_, after, lines) => {
    const path = after.startsWith('runs:') ? '.github/actions/x/action.yml' : WORKFLOW;
    expect(findings(path, after)).toEqual(lines.map((line) => ({ rule: 'run-expression', file: path, line })));
  });

  it.each([
    ['an expression in env', 'steps:\n  - env:\n      REF: ${{ github.head_ref }}\n    run: echo "$REF"'],
    [
      'an expression in with, if and a job output',
      'jobs:\n  a:\n    outputs:\n      run: ${{ x }}\n    steps:\n      - if: ${{ a }}\n        uses: ./x\n        with:\n          script: ${{ y }}',
    ],
    ['an expression in a YAML comment after the run', 'steps:\n  - run: echo ok # ${{ x }}'],
  ])('passes %s', (_, after) => {
    expect(findings(WORKFLOW, after)).toEqual([]);
  });

  it('reads only workflow and action files, and not a deleted one', () => {
    const text = 'steps:\n  - run: echo ${{ x }}';
    expect(findings('docs/example.yml', text)).toEqual([]);
    expect(check(change([fileChange(WORKFLOW, { before: text })]))).toEqual([]);
  });
});
