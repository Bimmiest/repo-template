import { symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHECKS,
  format,
  parseNameStatus,
  parseOptions,
  readObjects,
  readTree,
  run,
  trailersOf,
  UsageError,
} from './check.mjs';
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
    write(root, { 'src/a.ts': BROKEN['src/a.ts'] });
    git(root, 'add', 'src/a.ts');
    write(root, { 'docs/adr/0001-x.md': 'rewritten\n' });
    const result = await run(['--staged', '--branch', 'main'], root);
    expect(rules(result)).toEqual(['eslint-disable']);
  });

  it('gives a fall with --staged as a warning with the trailer to add, as there is no commit message yet', async () => {
    const root = repository();
    write(root, { 'vitest.config.ts': CONFIG.replace('90', '80') });
    git(root, 'add', 'vitest.config.ts');
    const result = await run(['--staged', '--branch', 'main'], root);
    expect(result).toMatchObject({ code: 0, out: [] });
    expect(result.err[0]).toMatch(/^warning: vitest\.config\.ts:1: coverage-floor: /);
    expect(result.err[0]).toContain('Floor-Lowered: vitest.config.ts thresholds.lines 90 -> 80, <the reason>');
    expect(result.err.at(-1)).toBe('0 finding(s), and 1 warning(s), in 1 file(s).');
  });

  describe('a Floor-Lowered trailer with --base (#74)', () => {
    const TRAILER = 'Floor-Lowered: vitest.config.ts thresholds.lines 90 -> 80, the engine moved out';

    /** A branch that lowers the floor in one commit, with `message` as the message of the commit. */
    const lowered = (message) => {
      const root = repository();
      git(root, 'checkout', '-q', '-b', 'feature/x-1');
      write(root, { 'vitest.config.ts': CONFIG.replace('90', '80') });
      git(root, 'commit', '-q', '-am', message);
      return root;
    };
    const check = (root) => run(['--base', 'main', '--branch', 'main', '--only', 'coverage-floor'], root);

    it('passes a fall that a trailer of the branch names', async () => {
      expect(await check(lowered(`lower\n\nThe reason.\n\n${TRAILER}`))).toMatchObject({ code: 0, out: [] });
    });

    it('passes a fall with the trailer in a later commit, and a trailer folded over two lines', async () => {
      const root = lowered('lower');
      const folded = TRAILER.replace(', the engine', ',\n  the engine');
      git(root, 'commit', '-q', '--allow-empty', '-m', `record the fall\n\n${folded}`);
      expect(await check(root)).toMatchObject({ code: 0, out: [] });
    });

    it('fails a fall with no trailer, and gives the line to add', async () => {
      const result = await check(lowered('lower'));
      expect(rules(result)).toEqual(['coverage-floor']);
      expect(result.out[0]).toContain('`Floor-Lowered: vitest.config.ts thresholds.lines 90 -> 80, <the reason>`');
    });

    it('fails a fall that a line in the body names, as it is not a trailer', async () => {
      expect(rules(await check(lowered(`lower\n\n${TRAILER}\n\nThe reason.`)))).toEqual(['coverage-floor']);
    });

    it('reads only the Floor-Lowered trailers, and stops on a range that git cannot read', () => {
      const root = lowered(`lower\n\nCo-Authored-By: t <t@example.com>\nfloor-lowered: a k 1 -> 0, r\n${TRAILER}`);
      expect(trailersOf(root, 'main..HEAD')).toEqual(['a k 1 -> 0, r', TRAILER.slice('Floor-Lowered: '.length)]);
      expect(() => trailersOf(root, 'no-such-ref..HEAD')).toThrow(UsageError);
    });

    it('fails a trailer with other numbers, and a trailer that names no fall', async () => {
      const root = lowered(`lower\n\n${TRAILER.replace('-> 80', '-> 85')}`);
      expect((await check(root)).out).toEqual([
        expect.stringMatching(/^vitest\.config\.ts:1: coverage-floor: /),
        expect.stringMatching(/^coverage-floor: /),
      ]);
      git(root, 'checkout', '-q', 'main');
      git(root, 'checkout', '-q', '-b', 'feature/y-2');
      git(root, 'commit', '-q', '--allow-empty', '-m', `stale\n\n${TRAILER}`);
      const stale = await check(root);
      expect(stale.out).toEqual([expect.stringMatching(/^coverage-floor: /)]);
    });
  });

  describe('a name in a comment that is in no source file (#57)', () => {
    const only = ['--branch', 'main', '--only', 'known-identifier'];

    it('fails a comment in a file that the branch does not touch, when the branch renames the name', async () => {
      const root = repository();
      write(root, { 'src/limit.ts': 'export const CACHE_LIMIT = 1;\n', 'src/run.ts': '// `CACHE_LIMIT` caps it.\n' });
      git(root, 'add', '.');
      git(root, 'commit', '-q', '-m', 'limit');
      git(root, 'checkout', '-q', '-b', 'feature/x-1');
      write(root, { 'src/limit.ts': 'export const CACHE_MAX = 1;\n' });
      git(root, 'commit', '-q', '-am', 'rename');
      const result = await run(['--base', 'main', ...only], root);
      expect(result.out).toEqual([expect.stringMatching(/^src\/run\.ts:1: known-identifier: `CACHE_LIMIT` /)]);
      write(root, { 'src/run.ts': '// `CACHE_MAX` caps it.\n' });
      git(root, 'commit', '-q', '-am', 'follow');
      expect(await run(['--base', 'main', ...only], root)).toMatchObject({ code: 0, out: [] });
    });

    it('checks a new comment with --staged against the index, and with a path against the work tree', async () => {
      const root = repository();
      write(root, { 'src/b.ts': '// `stageName` and `diskName`.\n' });
      git(root, 'add', 'src/b.ts');
      write(root, { 'src/stage.ts': 'export const stageName = 1;\n' });
      git(root, 'add', 'src/stage.ts');
      write(root, { 'src/stage.ts': 'export const diskName = 1;\n' });
      expect((await run(['--staged', ...only], root)).out).toEqual([expect.stringContaining('`diskName`')]);
      expect((await run([...only, 'src/b.ts'], root)).out).toEqual([expect.stringContaining('`stageName`')]);
    });
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

describe('readTree and readObjects', () => {
  it('reads each tracked text file on each side, with the files of the change on top', () => {
    const root = repository();
    write(root, { 'src/b.ts': 'b', 'src/bin.dat': 'a\0b', 'docs/a.md': 'm' });
    symlinkSync('a.ts', path.join(root, 'src/link.ts'));
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'more');
    write(root, { 'src/b.ts': 'staged' });
    git(root, 'add', 'src/b.ts');
    write(root, { 'src/b.ts': 'on disk', 'src/untracked.ts': 'u' });
    const select = (file) => file.startsWith('src/');
    const read = (side, files = []) => Object.fromEntries(readTree({ root, side, files, select }));
    expect(read('HEAD')).toEqual({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': 'b' });
    expect(read('index')['src/b.ts']).toBe('staged');
    expect(read('work tree')['src/b.ts']).toBe('on disk');
    const files = [
      { path: 'src/a.ts', status: 'deleted', before: () => 'x', after: () => null },
      { path: 'src/new.ts', status: 'added', before: () => null, after: () => 'n' },
      { path: 'src/bin2.dat', status: 'added', before: () => null, after: () => '\0' },
      { path: 'docs/a.md', status: 'modified', before: () => 'm', after: () => 'n' },
    ];
    expect(read('HEAD', files)).toEqual({ 'src/b.ts': 'b', 'src/new.ts': 'n' });
  });

  it('gives null for an object that is not there or is not a blob, in the order of the names', () => {
    const root = repository();
    const objects = readObjects(root, ['HEAD:src/a.ts', 'HEAD:nope', 'HEAD:src', 'HEAD:src/a.ts']);
    expect(objects.map((o) => o?.toString('utf8') ?? null)).toEqual([
      'export const a = 1;\n',
      null,
      null,
      'export const a = 1;\n',
    ]);
    expect(readObjects(root, [])).toEqual([]);
  });
});
