/**
 * The builders of the script tests that need a git repository: a temporary
 * directory, git with a fixed identity, and a repository whose first commit
 * passes each rule. Each test file calls `removeTempDirs` in its `afterEach`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** A commit SHA in the form that the `uses-pin` rule accepts. */
export const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';

/** An accepted ADR. */
export const ADR = '# 0001. X\n\n- **Status:** Accepted\n\n## Decision\n\nThe rule.\n';

/** A vitest config with a coverage floor. */
export const CONFIG = 'export default { test: { coverage: { thresholds: { lines: 90 } } } };\n';

/** A workflow that keeps the rules. */
export const WORKFLOW = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n      - run: echo ok\n`;

/** A line with an `eslint-disable` directive, written in two parts so that this file has none. */
export const DISABLE = ['/', '/ eslint-disable-next-line no-console'].join('');

/** The directories that the tests made, for `removeTempDirs`. */
const dirs = [];

/** Removes each directory that `tempDir` made. */
export function removeTempDirs() {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** A new directory that `removeTempDirs` removes. */
export function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-'));
  dirs.push(dir);
  return dir;
}

/** Runs git in `cwd`, with an identity and no signing, so that the global config cannot change a test. */
export function git(cwd, ...args) {
  return execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' },
  );
}

/** Writes each file of `files` under `root`. */
export function write(root, files) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
}

/** A repository with one commit on `main` that passes each check. */
export function repository() {
  const root = tempDir();
  git(root, 'init', '-q', '-b', 'main');
  write(root, {
    '.github/workflows/ci.yml': WORKFLOW,
    'docs/adr/0001-x.md': ADR,
    'vitest.config.ts': CONFIG,
    'src/a.ts': 'export const a = 1;\n',
    'pcre2.wasm': 'binary',
    'pcre2.wasm.sha256': 'sum',
  });
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}

/** A clone of shared-workflows with the branch pattern of PR hygiene, for the `branch-name` rule. */
export function sharedWorkflows() {
  const dir = tempDir();
  write(dir, {
    '.github/actions/pr-hygiene/pr-hygiene.mjs': 'export const branchPattern = () => /^feature\\/[a-z-]+-[0-9]+$/;\n',
  });
  return dir;
}
