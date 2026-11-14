import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHECKS, format, parseNameStatus, parseOptions, run } from './check.mjs';
import {
  ADR,
  CONFIG,
  DISABLE,
  git,
  removeTempDirs,
  repository,
  SHA,
  sharedWorkflows,
  tempDir,
  WORKFLOW,
  write,
} from './test-repository.mjs';

afterEach(removeTempDirs);

/** A change that breaks each rule that a file can break. */
const BROKEN = {
  '.github/workflows/ci.yml': WORKFLOW.replace('echo ok', 'echo ${{ github.head_ref }}').replace(SHA, 'v7'),
  'docs/adr/0001-x.md': ADR.replace('The rule.', 'Another rule.'),
  'vitest.config.ts': CONFIG.replace('90', '80'),
  'src/a.ts': `export const a = 1;\n${DISABLE}\n`,
  'pcre2.wasm': 'another binary',
};

const rules = ({ out }) => out.map((line) => line.split(': ')[1]);

describe('parseOptions', () => {
  it('takes one mode, and each rule by default', () => {
    expect(parseOptions(['--base', 'origin/main'])).toMatchObject({
      base: 'origin/main',
      only: CHECKS.map((c) => c.rule),
    });
    expect(parseOptions(['--staged', '--only', 'uses-pin, wasm-pair'])).toMatchObject({
      staged: true,
      only: ['uses-pin', 'wasm-pair'],
    });
    expect(parseOptions(['--', '-a.ts', 'b.ts'])).toMatchObject({ paths: ['-a.ts', 'b.ts'] });
  });

  it('takes the hook modes, and the gate command after --', () => {
    expect(parseOptions(['--hook'])).toMatchObject({ hook: true, gate: null, paths: [] });
    expect(parseOptions(['--gate', '--', 'npm', 'run', '--silent', 'gates'])).toMatchObject({
      hook: false,
      gate: ['npm', 'run', '--silent', 'gates'],
      paths: [],
    });
  });

  it.each([
    [[]],
    [['--staged', 'a.ts']],
    [['--base', 'x', '--staged']],
    [['--only', 'nope', 'a.ts']],
    [['--bogus', 'a.ts']],
    [['--hook', 'a.ts']],
    [['--hook', '--staged']],
    [['--gate']],
    [['--hook', '--gate', '--', 'npm']],
  ])('refuses %j', (argv) => {
    expect(() => parseOptions(argv)).toThrow();
  });
});

describe('format and parseNameStatus', () => {
  it('prints a place when the finding has one', () => {
    expect(format({ rule: 'uses-pin', file: 'a.yml', line: 3, message: 'm' })).toBe('a.yml:3: uses-pin: m');
    expect(format({ rule: 'branch-name', file: null, line: 0, message: 'm' })).toBe('branch-name: m');
  });

  it('reads the -z output of git diff --name-status', () => {
    expect(parseNameStatus('M\0a b.ts\0A\0new\0D\0old\0T\0link\0')).toEqual([
      { status: 'modified', path: 'a b.ts' },
      { status: 'added', path: 'new' },
      { status: 'deleted', path: 'old' },
      { status: 'modified', path: 'link' },
    ]);
  });
});

describe('run', () => {
  it('checks the commits since the merge base with --base', async () => {
    const root = repository();
    git(root, 'checkout', '-q', '-b', 'feature/x-1');
    write(root, BROKEN);
    git(root, 'commit', '-q', '-am', 'break');
    write(root, { 'src/a.ts': 'export const a = 2;\n' });
    const result = await run(
      ['--base', 'main', '--only', 'run-expression,uses-pin,accepted-adr,coverage-floor,eslint-disable,wasm-pair'],
      root,
    );
    expect(result.code).toBe(1);
    expect(rules(result)).toEqual([
      'run-expression',
      'uses-pin',
      'accepted-adr',
      'coverage-floor',
      'eslint-disable',
      'wasm-pair',
    ]);
    expect(result.out[0]).toMatch(/^\.github\/workflows\/ci\.yml:5: /);
  });

  it('passes a change that keeps the rules', async () => {
    const root = repository();
    git(root, 'checkout', '-q', '-b', 'feature/x-1');
    write(root, { 'vitest.config.ts': CONFIG.replace('90', '95'), 'pcre2.wasm': 'b2', 'pcre2.wasm.sha256': 's2' });
    git(root, 'commit', '-q', '-am', 'raise');
    expect(await run(['--base', 'main', '--branch', 'main'], root)).toMatchObject({ out: [], code: 0 });
  });

  it('checks the index with --staged, and not the work tree', async () => {
    const root = repository();
    write(root, { 'vitest.config.ts': CONFIG.replace('90', '80') });
    git(root, 'add', 'vitest.config.ts');
    write(root, { 'docs/adr/0001-x.md': 'rewritten\n' });
    const result = await run(['--staged', '--branch', 'main'], root);
    expect(rules(result)).toEqual(['coverage-floor']);
  });

  it('checks the files on disk against HEAD, from a subdirectory', async () => {
    const root = repository();
    write(root, { 'src/a.ts': BROKEN['src/a.ts'], 'src/new.ts': BROKEN['src/a.ts'] });
    unlinkSync(path.join(root, 'docs/adr/0001-x.md'));
    const argv = ['--branch', 'main', 'a.ts', 'new.ts', '../docs/adr/0001-x.md', '../../outside.ts', 'missing.ts'];
    const result = await run(argv, path.join(root, 'src'));
    expect(rules(result)).toEqual(['accepted-adr', 'eslint-disable', 'eslint-disable']);
  });

  it('checks the branch with the pattern of a shared-workflows clone', async () => {
    const root = repository();
    const shared = sharedWorkflows();
    git(root, 'checkout', '-q', '-b', 'claude/x');
    const argv = ['--staged', '--only', 'branch-name', '--shared-workflows', shared];
    expect(await run(argv, root)).toMatchObject({ code: 1, out: [expect.stringMatching(/^branch-name: /)] });
    expect(await run([...argv, '--branch', 'feature/ok-1'], root)).toMatchObject({ code: 0 });
  });

  it('says that it did not check the branch when there is no clone of shared-workflows', async () => {
    const root = repository();
    const result = await run(['--staged', '--branch', 'claude/x', '--shared-workflows', tempDir()], root);
    expect(result).toMatchObject({ code: 0, out: [] });
    expect(result.err[0]).toMatch(/^branch-name: /);
  });

  it.each([
    ['a ref that is an option', ['--base', '--output=x']],
    ['a ref with no merge base', ['--base', 'no-such-ref']],
    ['no mode', []],
  ])('exits 2 for %s', async (_, argv) => {
    expect(await run(argv, repository())).toMatchObject({ code: 2, out: [] });
  });

  it('exits 2 outside a git repository', async () => {
    expect(await run(['--staged'], tempDir())).toMatchObject({ code: 2 });
  });
});
