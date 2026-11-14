#!/usr/bin/env node
/**
 * The mechanical rules of CLAUDE.md, as one script that each caller runs, so
 * that each caller gives the same verdict (#47). CI runs it on the change of a
 * pull request. The git hooks in .githooks/ run it on the staged files and on
 * the branch, and the Claude Code hooks run it on the change of one tool call
 * (docs/adr/0006-one-rule-script-three-callers-and-only-ci-enforces.md).
 *
 *   node scripts/check.mjs --base <ref>     the commits since the merge base with <ref>
 *   node scripts/check.mjs --staged         the index, against HEAD
 *   node scripts/check.mjs <path>...        the files on disk, against HEAD
 *   node scripts/check.mjs --hook           a Claude Code PreToolUse hook (scripts/check-hook.mjs)
 *   node scripts/check.mjs --gate -- <cmd>  a PreToolUse hook that runs <cmd> before a pull request
 *
 *   --only <rule>,...          run only these rules (the `rule` of each check)
 *   --branch <name>            the branch to check, instead of the branch of HEAD
 *   --shared-workflows <dir>   the clone of shared-workflows for the branch rule
 *                              (default: ../shared-workflows, next to the repository)
 *
 * Prints each finding as `file:line: rule: what to change`, and exits 1 when
 * there is a finding, 0 when there is none, and 2 when it cannot run. A hook
 * mode reads the PreToolUse JSON from stdin and follows the exit codes of
 * Claude Code instead: 2 refuses the tool call, and 0 and 1 let it go ahead.
 *
 * Each input is data. A path, a ref and file content go to git as items of an
 * argument array, never through a shell, and no content is run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { hook } from './check-hook.mjs';
import * as acceptedAdr from './checks/accepted-adr.mjs';
import * as branchName from './checks/branch-name.mjs';
import * as coverageFloor from './checks/coverage-floor.mjs';
import * as eslintDisable from './checks/eslint-disable.mjs';
import * as runExpression from './checks/run-expression.mjs';
import * as usesPin from './checks/uses-pin.mjs';
import * as wasmPair from './checks/wasm-pair.mjs';

/**
 * @typedef {object} FileChange
 * @property {string} path  The path from the root of the repository, with `/`.
 * @property {'added' | 'modified' | 'deleted'} status
 * @property {() => string | null} before  The text before the change, or null when there was no file.
 * @property {() => string | null} after  The text after the change, or null when there is no file.
 */

/**
 * @typedef {object} Change
 * @property {FileChange[]} files
 * @property {string | null} branch  The branch of the change, or null when HEAD is detached.
 * @property {RegExp | null} branchPattern  The branch pattern of PR hygiene, or null when it is not loaded.
 * @property {(path: string) => boolean} exists  Whether the path is in the tree after the change.
 */

/**
 * @typedef {object} Finding
 * @property {'run-expression' | 'uses-pin' | 'accepted-adr' | 'coverage-floor' | 'eslint-disable' | 'branch-name' | 'wasm-pair'} rule
 * @property {string | null} file  The file, or null for a finding about the branch.
 * @property {number} line  The line from 1, or 0 when the finding has no line.
 * @property {string} message  What to change.
 */

/** Each check, in the order of the list in #47. */
export const CHECKS = [runExpression, usesPin, acceptedAdr, coverageFloor, eslintDisable, branchName, wasmPair];

/** An error that stops the run with exit code 2 and its message. */
export class UsageError extends Error {}

const STATUS = { A: 'added', M: 'modified', D: 'deleted', T: 'modified' };

/** The output of `git args` in `cwd`, or null when git fails. */
export function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  } catch {
    return null;
  }
}

/** A function that reads `rev:path` once, and gives null when there is no such blob. */
export function blob(root, rev, file) {
  let text;
  return () => {
    text ??= git(root, ['show', `${rev}:${file}`]);
    return text;
  };
}

/** The changed files from the `-z` output of `git diff --name-status`. */
export function parseNameStatus(output) {
  const parts = output.split('\0').filter((p) => p !== '');
  const files = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    files.push({ status: STATUS[parts[i][0]] ?? 'modified', path: parts[i + 1] });
  }
  return files;
}

/** The commits since the merge base of `ref` and HEAD. */
export function fromBase(root, ref) {
  if (ref.startsWith('-') || /\s/.test(ref)) throw new UsageError(`--base takes a git ref, not \`${ref}\`.`);
  const base = git(root, ['merge-base', ref, 'HEAD'])?.trim();
  if (!base) {
    throw new UsageError(
      `No merge base of ${ref} and HEAD. Fetch the history of both (in CI, \`fetch-depth: 0\` on the checkout).`,
    );
  }
  const diff = git(root, ['diff', '--name-status', '--no-renames', '-z', base, 'HEAD']) ?? '';
  return {
    files: parseNameStatus(diff).map((f) => ({
      ...f,
      before: blob(root, base, f.path),
      after: blob(root, 'HEAD', f.path),
    })),
    exists: (file) => git(root, ['cat-file', '-e', `HEAD:${file}`]) !== null,
  };
}

/** The index, against HEAD. */
export function fromIndex(root) {
  const diff = git(root, ['diff', '--cached', '--name-status', '--no-renames', '-z']) ?? '';
  return {
    files: parseNameStatus(diff).map((f) => ({
      ...f,
      before: blob(root, 'HEAD', f.path),
      after: blob(root, '', f.path),
    })),
    exists: (file) => git(root, ['cat-file', '-e', `:${file}`]) !== null,
  };
}

/**
 * The work tree, against HEAD: the changed tracked files, and the untracked
 * files that git does not ignore. It is what `git add -A && git commit` or
 * `git commit -a` commits, before the command runs.
 */
export function fromWorkTree(root) {
  const diff = git(root, ['diff', 'HEAD', '--name-status', '--no-renames', '-z']) ?? '';
  const untracked = (git(root, ['ls-files', '--others', '--exclude-standard', '-z']) ?? '')
    .split('\0')
    .filter((p) => p !== '')
    .map((p) => ({ status: 'added', path: p }));
  const onDisk = (file) => () => {
    const absolute = path.join(root, file);
    return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
  };
  return {
    files: [...parseNameStatus(diff), ...untracked].map((f) => ({
      ...f,
      before: blob(root, 'HEAD', f.path),
      after: onDisk(f.path),
    })),
    exists: (file) => existsSync(path.join(root, file)),
  };
}

/** The files `paths` on disk, against HEAD. A path outside the repository is not checked. */
function fromPaths(root, paths, cwd) {
  const files = [];
  for (const given of paths) {
    const relative = path.relative(root, path.resolve(cwd, given)).split(path.sep).join('/');
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
    const absolute = path.join(root, relative);
    const after = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
    const before = blob(root, 'HEAD', relative);
    const status = after === null ? 'deleted' : before() === null ? 'added' : 'modified';
    if (after === null && before() === null) continue;
    files.push({ path: relative, status, before, after: () => after });
  }
  return { files, exists: (file) => existsSync(path.join(root, file)) };
}

/** The `branchPattern` of PR hygiene, from the clone of shared-workflows at `dir`, or null when there is none. */
export async function loadBranchPattern(dir) {
  const script = path.join(dir, '.github', 'actions', 'pr-hygiene', 'pr-hygiene.mjs');
  if (!existsSync(script)) return null;
  const hygiene = await import(pathToFileURL(script).href);
  return typeof hygiene.branchPattern === 'function' ? hygiene.branchPattern() : null;
}

/** The options of a run, from the command line. Throws a UsageError for a wrong command line. */
export function parseOptions(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        base: { type: 'string' },
        staged: { type: 'boolean', default: false },
        hook: { type: 'boolean', default: false },
        gate: { type: 'boolean', default: false },
        only: { type: 'string' },
        branch: { type: 'string' },
        'shared-workflows': { type: 'string' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;
  const paths = values.gate ? [] : positionals;
  const modes = [values.base !== undefined, values.staged, values.hook, values.gate, paths.length > 0];
  if (modes.filter(Boolean).length !== 1) {
    throw new UsageError('Give one of --base <ref>, --staged, --hook, --gate -- <command>, or the paths to check.');
  }
  if (values.gate && positionals.length === 0) throw new UsageError('--gate takes the gate command after `--`.');
  const rules = CHECKS.map((c) => c.rule);
  const only = values.only === undefined ? rules : values.only.split(',').map((r) => r.trim());
  const unknown = only.filter((r) => !rules.includes(r));
  if (unknown.length > 0) throw new UsageError(`No rule ${unknown.join(', ')}. The rules: ${rules.join(', ')}.`);
  return {
    base: values.base,
    staged: values.staged,
    hook: values.hook,
    gate: values.gate ? positionals : null,
    paths,
    only,
    branch: values.branch,
    sharedWorkflows: values['shared-workflows'],
  };
}

/** The line that prints `finding`. */
export function format({ rule, file, line, message }) {
  return file === null ? `${rule}: ${message}` : `${file}:${line}: ${rule}: ${message}`;
}

/** The branch of HEAD in `root`, or null when HEAD is detached. */
export function currentBranch(root) {
  return git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim() ?? null;
}

/**
 * Runs the checks `only` on a change. Gives the findings, and the notes for
 * stderr: a rule that did not run, and the count.
 *
 * @param {{ root: string, files: FileChange[], exists: (path: string) => boolean, branch: string | null,
 *   only: string[], sharedWorkflows?: string }} options
 */
export async function evaluate({ root, files, exists, branch, only, sharedWorkflows }) {
  const notes = [];
  let branchPattern = null;
  if (only.includes(branchName.rule) && branch !== null && branch !== 'main') {
    const dir = sharedWorkflows ?? path.resolve(root, '..', 'shared-workflows');
    branchPattern = await loadBranchPattern(dir);
    if (branchPattern === null) notes.push(`${branchName.rule}: not checked. No clone of shared-workflows at ${dir}.`);
  }
  const change = { files, branch, branchPattern, exists };
  const findings = CHECKS.filter((c) => only.includes(c.rule)).flatMap((c) => c.check(change));
  notes.push(`${findings.length} finding(s) in ${files.length} file(s).`);
  return { findings, notes };
}

/**
 * Runs the checks for the command line `argv` in the directory `cwd`. Gives
 * the lines for stdout and stderr, and the exit code. A hook mode reads its
 * input from `context.stdin`. `context.project` is the repository whose
 * rules the hook applies, by default the repository of this script.
 *
 * @param {string[]} argv
 * @param {string} [cwd]
 * @param {{ stdin?: string, project?: string }} [context]
 */
export async function run(argv, cwd = process.cwd(), context = {}) {
  try {
    const options = parseOptions(argv);
    if (options.hook || options.gate !== null) {
      const project = context.project ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const { gate, only, sharedWorkflows } = options;
      return await hook({ stdin: context.stdin ?? '', project, gate, only, sharedWorkflows });
    }
    const root = git(cwd, ['rev-parse', '--show-toplevel'])?.trim();
    if (!root) throw new UsageError('This is not a git repository. Run the checks inside one.');
    const { files, exists } =
      options.base !== undefined
        ? fromBase(root, options.base)
        : options.staged
          ? fromIndex(root)
          : fromPaths(root, options.paths, cwd);
    const branch = options.branch ?? currentBranch(root);
    const { only, sharedWorkflows } = options;
    const { findings, notes } = await evaluate({ root, files, exists, branch, only, sharedWorkflows });
    return { out: findings.map(format), err: notes, code: findings.length === 0 ? 0 : 1 };
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    return { out: [], err: [error.message], code: 2 };
  }
}

/** The text of stdin, or an empty string when there is none. */
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(path.resolve(process.argv[1]))).href) {
  const argv = process.argv.slice(2);
  const hookMode = argv.includes('--hook') || argv.includes('--gate');
  const { out, err, code } = await run(argv, process.cwd(), hookMode ? { stdin: readStdin() } : {});
  for (const line of out) console.log(line);
  for (const line of err) console.error(line);
  process.exitCode = code;
}
