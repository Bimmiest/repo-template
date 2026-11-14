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
 * there is a finding, 0 when there is none, and 2 when it cannot run. A
 * warning goes to stderr and does not change the exit code: a rule gives one
 * when it needs a commit message that the change does not have yet. A hook
 * mode reads the PreToolUse JSON from stdin and follows the exit codes of
 * Claude Code instead: 2 refuses the tool call, and 0 and 1 let it go ahead.
 *
 * Each input is data. A path, a ref and file content go to git as items of an
 * argument array, never through a shell, and no content is run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { hook } from './check-hook.mjs';
import * as acceptedAdr from './checks/accepted-adr.mjs';
import * as branchName from './checks/branch-name.mjs';
import * as coverageFloor from './checks/coverage-floor.mjs';
import * as eslintDisable from './checks/eslint-disable.mjs';
import * as knownIdentifier from './checks/known-identifier.mjs';
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
 * @property {string[] | null} trailers  The value of each `Floor-Lowered:` trailer in the commit messages of
 *   the change, or null when the change has no commit message yet (the index, a file, an edit).
 * @property {(select: (path: string) => boolean) => Map<string, string>} texts  The text of each tracked text
 *   file after the change whose path `select` accepts, by path. It reads the whole tree, so call it once.
 */

/**
 * Where the files after a change are: in the commit HEAD (`--base`), in the
 * index (`--staged`), or in the work tree (a path, and the hooks).
 * @typedef {'HEAD' | 'index' | 'work tree'} Side
 */

/**
 * @typedef {object} Finding
 * @property {'run-expression' | 'uses-pin' | 'accepted-adr' | 'coverage-floor' | 'eslint-disable' | 'branch-name' | 'wasm-pair' |
 *   'known-identifier'} rule
 * @property {string | null} file  The file, or null for a finding about the branch or a commit message.
 * @property {number} line  The line from 1, or 0 when the finding has no line.
 * @property {string} message  What to change.
 * @property {boolean} [warning]  True when the run cannot decide, because the change has no commit message
 *   yet. A warning goes to stderr, and does not fail the run.
 * @property {string} [trailer]  The commit trailer that records a floor that falls, when one can.
 */

/** Each check: the list of #47 in its order, then the later checks. */
export const CHECKS = [
  runExpression,
  usesPin,
  acceptedAdr,
  coverageFloor,
  eslintDisable,
  branchName,
  wasmPair,
  knownIdentifier,
];

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
  const changed = parseNameStatus(diff);
  const before = blobs(
    root,
    base,
    changed.filter((f) => f.status !== 'added').map((f) => f.path),
  );
  const after = blobs(
    root,
    'HEAD',
    changed.filter((f) => f.status !== 'deleted').map((f) => f.path),
  );
  return {
    files: changed.map((f) => ({ ...f, before: before(f.path), after: after(f.path) })),
    exists: (file) => git(root, ['cat-file', '-e', `HEAD:${file}`]) !== null,
    trailers: trailersOf(root, `${base}..HEAD`),
    side: 'HEAD',
  };
}

/**
 * The value of each `Floor-Lowered:` trailer in the commits of `range`. Git
 * parses the trailers, as `git interpret-trailers` does, so a line in the
 * body of a message is not a trailer. Throws a UsageError when git cannot
 * read the range, because a run with no trailers fails each recorded fall.
 */
export function trailersOf(root, range) {
  const format = `--format=%(trailers:key=${coverageFloor.TRAILER},valueonly,unfold)`;
  const output = git(root, ['log', '-z', '--no-show-signature', format, range]);
  if (output === null) throw new UsageError(`git cannot read the commit messages of ${range}.`);
  return output
    .split(/[\0\n]/)
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

/** The index, against HEAD. */
export function fromIndex(root) {
  const diff = git(root, ['diff', '--cached', '--name-status', '--no-renames', '-z']) ?? '';
  const changed = parseNameStatus(diff);
  const before = blobs(
    root,
    'HEAD',
    changed.filter((f) => f.status !== 'added').map((f) => f.path),
  );
  const after = blobs(
    root,
    '',
    changed.filter((f) => f.status !== 'deleted').map((f) => f.path),
  );
  return {
    files: changed.map((f) => ({ ...f, before: before(f.path), after: after(f.path) })),
    exists: (file) => git(root, ['cat-file', '-e', `:${file}`]) !== null,
    trailers: null,
    side: 'index',
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
    trailers: null,
    side: 'work tree',
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
  return { files, exists: (file) => existsSync(path.join(root, file)), trailers: null, side: 'work tree' };
}

/** The tracked files on `side`, from `git ls-tree` or `git ls-files`, with their mode and blob. */
function trackedFiles(root, side) {
  const output =
    side === 'HEAD'
      ? git(root, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'])
      : git(root, ['ls-files', '--stage', '-z']);
  const entries = new Map();
  for (const entry of (output ?? '').split('\0')) {
    const tab = entry.indexOf('\t');
    if (tab === -1) continue;
    const [mode, second, third] = entry.slice(0, tab).split(' ');
    const sha = side === 'HEAD' ? third : second;
    if (!entries.has(entry.slice(tab + 1))) entries.set(entry.slice(tab + 1), { mode, sha });
  }
  return entries;
}

/**
 * The content of each git object `names`, in their order, from one
 * `git cat-file --batch`, or null for an object that is not there or is not a
 * blob. A name is a SHA or `<rev>:<path>`, and has no new line.
 */
export function readObjects(root, names) {
  if (names.length === 0) return [];
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: `${names.join('\n')}\n`,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 1 << 30,
  });
  const objects = [];
  let at = 0;
  while (at < output.length && objects.length < names.length) {
    const newline = output.indexOf(10, at);
    const [, type, size] = output.subarray(at, newline).toString('latin1').split(' ');
    if (size === undefined || !/^\d+$/.test(size)) {
      objects.push(null);
      at = newline + 1;
      continue;
    }
    const end = newline + 1 + Number(size);
    objects.push(type === 'blob' ? output.subarray(newline + 1, end) : null);
    at = end + 1;
  }
  return objects;
}

/**
 * A function that gives the reader of `rev:path` for each path of `paths`,
 * like `blob`. The first read reads each path in one `git cat-file --batch`,
 * so that a change of many files does not start one git for each file. A
 * path with a new line is read alone.
 */
export function blobs(root, rev, paths) {
  let texts;
  const all = () => {
    if (texts !== undefined) return texts;
    const batch = paths.filter((file) => !file.includes('\n'));
    const objects = readObjects(
      root,
      batch.map((file) => `${rev}:${file}`),
    );
    texts = new Map(batch.map((file, i) => [file, objects[i]?.toString('utf8') ?? null]));
    return texts;
  };
  return (file) => (file.includes('\n') ? blob(root, rev, file) : () => all().get(file) ?? null);
}

/** Whether `content` is binary: a NUL byte in its first 8000 bytes, as git decides. */
const isBinary = (content) => content.subarray(0, 8000).includes(0);

/**
 * The text of each tracked file on `side` whose path `select` accepts, by
 * path. Each file of `files` replaces its entry, so that a change that is not
 * on disk yet (an edit of a hook) is in it. A binary file, a symbolic link
 * and a submodule are not in it.
 *
 * @param {{ root: string, side: Side, files: FileChange[], select: (path: string) => boolean }} options
 */
export function readTree({ root, side, files, select }) {
  const entries = [...trackedFiles(root, side)].filter(
    ([file, { mode }]) => mode !== '120000' && mode !== '160000' && select(file),
  );
  const texts = new Map();
  if (side === 'work tree') {
    for (const [file] of entries) {
      const absolute = path.join(root, file);
      if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
      const content = readFileSync(absolute);
      if (!isBinary(content)) texts.set(file, content.toString('utf8'));
    }
  } else {
    const objects = readObjects(
      root,
      entries.map(([, { sha }]) => sha),
    );
    entries.forEach(([file], i) => {
      const content = objects[i];
      if (content !== null && content !== undefined && !isBinary(content)) texts.set(file, content.toString('utf8'));
    });
  }
  for (const file of files) {
    if (!select(file.path)) continue;
    const text = file.status === 'deleted' ? null : file.after();
    if (text === null || text.includes('\0')) texts.delete(file.path);
    else texts.set(file.path, text);
  }
  return texts;
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
 *   only: string[], sharedWorkflows?: string, trailers?: string[] | null, side?: Side }} options
 *   `trailers` is null, the default, for a change with no commit message yet. `side` is where the
 *   files after the change are, by default the work tree.
 */
export async function evaluate(options) {
  const { root, files, exists, branch, only, sharedWorkflows, trailers = null, side = 'work tree' } = options;
  const notes = [];
  let branchPattern = null;
  if (only.includes(branchName.rule) && branch !== null && branch !== 'main') {
    const dir = sharedWorkflows ?? path.resolve(root, '..', 'shared-workflows');
    branchPattern = await loadBranchPattern(dir);
    if (branchPattern === null) notes.push(`${branchName.rule}: not checked. No clone of shared-workflows at ${dir}.`);
  }
  const texts = (select) => readTree({ root, side, files, select });
  const change = { files, branch, branchPattern, exists, trailers, texts };
  const all = CHECKS.filter((c) => only.includes(c.rule)).flatMap((c) => c.check(change));
  const findings = all.filter((f) => f.warning !== true);
  const warnings = all.filter((f) => f.warning === true);
  notes.push(...warnings.map((w) => `warning: ${format(w)}`));
  const counted = warnings.length === 0 ? '' : `, and ${warnings.length} warning(s),`;
  notes.push(`${findings.length} finding(s)${counted} in ${files.length} file(s).`);
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
    const { files, exists, trailers, side } =
      options.base !== undefined
        ? fromBase(root, options.base)
        : options.staged
          ? fromIndex(root)
          : fromPaths(root, options.paths, cwd);
    const branch = options.branch ?? currentBranch(root);
    const { only, sharedWorkflows } = options;
    const { findings, notes } = await evaluate({ root, files, exists, branch, only, sharedWorkflows, trailers, side });
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
