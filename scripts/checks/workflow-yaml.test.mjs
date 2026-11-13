import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isWorkflowFile, readKeys, readWorkflow } from './workflow-yaml.mjs';

const keys = (text) => readWorkflow(text).map(({ key, line, value, comment }) => ({ key, line, value, comment }));

describe('readWorkflow', () => {
  it('reads a plain run and a pinned uses with its comment', () => {
    const text = [
      'jobs:',
      '  a:',
      '    steps:',
      '      - uses: actions/checkout@abc # v1.2.3',
      '      - name: Build',
      '        run: npm run build # not part of the value',
    ].join('\n');
    expect(keys(text)).toEqual([
      { key: 'uses', line: 4, value: 'actions/checkout@abc', comment: '# v1.2.3' },
      { key: 'run', line: 6, value: 'npm run build', comment: '# not part of the value' },
    ]);
  });

  it.each(['|', '|-', '>', '>+', '|2', '| # a comment'])('reads the block scalar %j to its end', (header) => {
    const text = [
      'steps:',
      `  - run: ${header}`,
      '      echo "$A"',
      '',
      '      # a comment of the script, with uses: x',
      '      uses: not-a-key',
      '  - uses: ./local',
    ].join('\n');
    const entries = readWorkflow(text);
    expect(entries.map((e) => [e.key, e.line])).toEqual([
      ['run', 2],
      ['uses', 7],
    ]);
    expect(entries[0]?.lines.map((l) => l.line)).toEqual([3, 4, 5, 6]);
  });

  it('reads quoted scalars over more than one line, with a comment after the quote', () => {
    const text = [
      'steps:',
      "  - run: 'echo ''it''s'",
      '  - run: "first',
      '      second ${{ x }}"',
      '  - uses: "owner/repo@abc" # v1.0.0',
      '  - with:',
      '      script: "run: inside a string"',
    ].join('\n');
    expect(keys(text)).toEqual([
      { key: 'run', line: 2, value: "echo ''it''s", comment: null },
      { key: 'run', line: 3, value: 'first second ${{ x }}', comment: null },
      { key: 'uses', line: 5, value: 'owner/repo@abc', comment: '# v1.0.0' },
    ]);
    expect(readWorkflow(text)[1]?.lines.map((l) => l.line)).toEqual([3, 4]);
  });

  it('reads a plain scalar over more than one line', () => {
    const text = ['steps:', '  - run:', '      echo one', '      ${{ two }}', '  - run: next'].join('\n');
    expect(readWorkflow(text).map((e) => e.lines.map((l) => l.line))).toEqual([[3, 4], [5]]);
  });

  it('reads no step in defaults.run, a job output named run, or a with input named uses', () => {
    const text = [
      'defaults:',
      '  run:',
      '    shell: bash',
      'jobs:',
      '  a:',
      '    outputs:',
      '      run: ${{ steps.plan.outputs.run }}',
      '    steps:',
      '      - uses: owner/repo@abc # v1.0.0',
      '        with:',
      '          uses: an-input',
      '  b:',
      '    uses: owner/repo/.github/workflows/x.yml@abc # v1.0.0',
    ].join('\n');
    expect(keys(text).map((e) => [e.key, e.line])).toEqual([
      ['uses', 9],
      ['uses', 13],
    ]);
    expect(readKeys(text).map((e) => [e.key, e.line])).toEqual([
      ['run', 2],
      ['run', 7],
      ['uses', 9],
      ['uses', 11],
      ['uses', 13],
    ]);
  });

  it('does not read the text of a block scalar item of a sequence as a key', () => {
    const text = ['steps:', '  - with:', '      args:', '        - |', '          run: x', '  - run: y'].join('\n');
    expect(keys(text).map((e) => e.line)).toEqual([6]);
  });

  it('reads a commented-out step as a comment', () => {
    expect(readWorkflow('steps:\n  # - run: echo ${{ x }}\n  - run: echo')).toHaveLength(1);
  });

  it('stops at a quoted scalar with no closing quote', () => {
    expect(keys('steps:\n  - run: "open\n  - run: next').map((e) => e.line)).toEqual([2]);
  });

  // The reader is a shortcut, so it is held to the real files of this
  // repository: each `run:` and `uses:` of a step is found, and nothing else.
  // A `run:` with no value and no `- ` is `defaults.run`, which is a mapping.
  it.each(readdirSync('.github/workflows').map((name) => `.github/workflows/${name}`))(
    'reads each step of %s',
    (file) => {
      const text = readFileSync(file, 'utf8');
      const expected = text.split('\n').filter((line) => /^\s*(?:-\s+)?(?:run|uses):/.test(line)).length;
      const nested = text.split('\n').filter((line) => /^\s+run:\s*$/.test(line) && !/^\s*-/.test(line)).length;
      expect(readWorkflow(text).length + nested).toBe(expected);
    },
  );
});

describe('isWorkflowFile', () => {
  it.each(['.github/workflows/ci.yml', '.github/actions/x/action.yaml'])('takes %s', (file) => {
    expect(isWorkflowFile(file)).toBe(true);
  });

  it.each(['.github/dependabot.yml', 'ci.yml', 'docs/.github/workflows/ci.yml', '.github/workflows/README.md'])(
    'leaves %s',
    (file) => {
      expect(isWorkflowFile(file)).toBe(false);
    },
  );
});
