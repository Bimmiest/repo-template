/**
 * The Claude Code side of scripts/check.mjs (#47). Claude Code runs it as a
 * `PreToolUse` hook (.claude/settings.json), before each tool call that can
 * change a file or the history. It builds the change that the call would
 * make, and runs the same checks as CI and the git hooks on that change.
 *
 * The contract is the one of https://code.claude.com/docs/en/hooks
 * ("PreToolUse input", "Exit code output"). Stdin is one JSON object with
 * `tool_name`, `tool_input` and `cwd`. The fields of `tool_input` that this
 * file reads: `file_path` and `content` (Write), `file_path`, `old_string`,
 * `new_string` and `replace_all` (Edit), and `command` (Bash, PowerShell).
 * Exit code 2 refuses the call, and Claude gets stderr as the reason. Exit
 * code 0 lets the call go ahead. Each other exit code is a non-blocking
 * error: the call goes ahead, and the transcript shows a notice.
 *
 * The input is data. A path and a command are never given to a shell: this
 * file reads a command as words, to find a `git commit`, a `git push` or a
 * `gh pr create` in it, and never runs it. Git and the gate command run
 * through execFileSync, with an argument array.
 *
 * The hook checks only the repository whose rules it has: the repository of
 * this script, and its worktrees. A file or a command in a different
 * repository passes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { blob, currentBranch, evaluate, format, fromBase, fromIndex, fromWorkTree, git, UsageError } from './check.mjs';

/**
 * The rules that one file can break. `wasm-pair` judges two files of one
 * commit, and a Write or an Edit has one file, so it runs at `git commit`.
 * `branch-name` judges a commit or a push, not a file.
 */
const FILE_RULES = ['run-expression', 'uses-pin', 'accepted-adr', 'coverage-floor', 'eslint-disable'];

/** The tool of the GitHub MCP server that opens a pull request. */
export const PULL_REQUEST_TOOL = 'mcp__github__create_pull_request';

/** The tools whose `tool_input.command` is a shell command. */
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/** The base that CI compares a pull request with. */
const BASE = 'origin/main';

/** An input that the hook cannot read, or a check that cannot run. */
class CannotRun extends Error {}

/** The verdict that lets the call go ahead. Claude Code shows nothing for it. */
const pass = (notes = []) => ({ out: [], err: notes, code: 0 });

/** The verdict that refuses the call. Claude gets `lines` as the reason. */
const refuse = (lines) => ({ out: [], err: lines, code: 2 });

/**
 * Runs the hook on the PreToolUse JSON `stdin`. Gives the lines for stdout and
 * stderr, and the exit code for Claude Code.
 *
 * @param {{ stdin: string, project: string, gate: string[] | null, only: string[], sharedWorkflows?: string }} options
 *   `project` is a directory of the repository whose rules apply. `gate` is
 *   the gate command for `--gate`, or null for the rule checks.
 */
export async function hook({ stdin, project, gate, only, sharedWorkflows }) {
  // Fail open: when the hook cannot run, it exits 1, and the call goes
  // ahead with a notice in the transcript. A bad input, a missing git or a
  // bug here then cannot stop each Edit and Bash call of a session, and a
  // model that is refused for a reason it cannot fix looks for a way
  // around the hook. CI runs the same checks on the pull request, and only
  // CI enforces (docs/adr/0006-one-rule-script-three-callers-and-only-ci-enforces.md).
  try {
    const input = parseInput(stdin);
    const home = repositoryOf(project);
    if (home === null) throw new CannotRun(`${project} is not in a git repository`);
    const context = { input, home: home.common, only, sharedWorkflows };
    return gate === null ? await checkCall(context) : runGate(context, gate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      out: [],
      err: [`scripts/check.mjs could not check this tool call, and lets it go ahead: ${reason}. CI checks it.`],
      code: 1,
    };
  }
}

/** The PreToolUse input in `stdin`. Throws CannotRun for an input that is not one. */
export function parseInput(stdin) {
  let input;
  try {
    input = JSON.parse(stdin);
  } catch {
    throw new CannotRun('stdin is not JSON');
  }
  if (typeof input !== 'object' || input === null) throw new CannotRun('stdin is not a JSON object');
  if (typeof input.tool_name !== 'string') throw new CannotRun('the input has no tool_name');
  if (typeof input.tool_input !== 'object' || input.tool_input === null) {
    throw new CannotRun('the input has no tool_input');
  }
  return { ...input, cwd: typeof input.cwd === 'string' ? input.cwd : process.cwd() };
}

/** The string `value` of the field `name`. Throws CannotRun when it is not a string. */
function field(value, name) {
  if (typeof value !== 'string') throw new CannotRun(`tool_input.${name} is not a string`);
  return value;
}

/** The root and the shared git directory of the repository at `dir`, or null outside a repository. */
function repositoryOf(dir) {
  const root = git(dir, ['rev-parse', '--show-toplevel'])?.trim();
  const common = git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir'])?.trim();
  if (!root || !common) return null;
  return { root, common: realpathSync(common) };
}

/** The repository at `dir` when it is the repository of the rules or one of its worktrees, else null. */
function inProject(context, dir) {
  if (dir === null) return null;
  const repository = repositoryOf(dir);
  return repository !== null && repository.common === context.home ? repository : null;
}

/** `file` with each symbolic link in its existing part resolved, so that it compares with a git root. */
function realPath(file) {
  let existing = path.resolve(file);
  const rest = [];
  while (!existsSync(existing) && path.dirname(existing) !== existing) {
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(realpathSync(existing), ...rest);
}

/** The rule checks for one tool call. */
async function checkCall(context) {
  const { tool_name: tool, tool_input: toolInput } = context.input;
  if (tool === 'Write' || tool === 'Edit') return fileCall(context, tool, toolInput);
  if (SHELL_TOOLS.has(tool)) return shellCall(context, field(toolInput.command, 'command'));
  return pass();
}

/**
 * The text of `file` after the Edit `toolInput`, or null when the Edit cannot
 * apply. Then the tool fails, and reports it, so the hook does not refuse.
 */
export function applyEdit(text, toolInput) {
  const before = field(toolInput.old_string, 'old_string');
  const after = field(toolInput.new_string, 'new_string');
  const current = text ?? '';
  if (text === null && before !== '') return null;
  const at = current.indexOf(before);
  if (at === -1) return null;
  if (toolInput.replace_all === true) return current.split(before).join(after);
  return current.slice(0, at) + after + current.slice(at + before.length);
}

/**
 * A Write or an Edit: the file after the call, against HEAD. HEAD, and not
 * the file on disk, because `git commit` compares with HEAD too. The hook
 * then refuses the call when the commit of its result fails, and a new ADR
 * that is not committed yet is still new.
 */
async function fileCall(context, tool, toolInput) {
  const file = realPath(field(toolInput.file_path, 'file_path'));
  const onDisk = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const text = tool === 'Write' ? field(toolInput.content, 'content') : applyEdit(onDisk, toolInput);
  if (text === null) return pass(['The edit does not apply. The tool reports it.']);
  let dir = path.dirname(file);
  while (!existsSync(dir)) dir = path.dirname(dir);
  const repository = inProject(context, dir);
  if (repository === null) return pass(['The file is not in this repository.']);
  const relative = path.relative(realpathSync(repository.root), file).split(path.sep).join('/');
  const before = blob(repository.root, 'HEAD', relative);
  const change = {
    root: repository.root,
    files: [{ path: relative, status: before() === null ? 'added' : 'modified', before, after: () => text }],
    exists: (other) => other === relative || existsSync(path.join(repository.root, other)),
    branch: null,
    only: context.only.filter((rule) => FILE_RULES.includes(rule)),
    sharedWorkflows: context.sharedWorkflows,
  };
  const { findings, notes } = await evaluate(change);
  return verdict(findings, notes, `this ${tool} of ${relative}`);
}

/** Refuses with `findings` when there are any, else passes with `notes`. */
function verdict(findings, notes, what) {
  if (findings.length === 0) return pass(notes);
  return refuse([
    `The rules of CLAUDE.md refuse ${what}. Change what each line says, and try again ` +
      '(scripts/check.mjs, docs/ci.md#the-rule-checks):',
    ...findings.map(format),
  ]);
}

/** A Bash or PowerShell command: the checks of each `git commit` and `git push` in it. */
async function shellCall(context, command) {
  const findings = [];
  const notes = [];
  let added = false;
  for (const { dir, words } of commandsOf(command, context.input.cwd)) {
    const call = gitCall(words, dir);
    if (call === null) continue;
    if (call.subcommand === 'add' || call.subcommand === 'stage' || call.subcommand === 'rm') added = true;
    const repository = inProject(context, call.dir);
    if (repository === null) continue;
    const result =
      call.subcommand === 'commit'
        ? await commitCall(context, repository.root, added || commitTakesWorkTree(call.args))
        : call.subcommand === 'push'
          ? await pushCall(context, repository.root, call.args)
          : null;
    if (result === null) continue;
    findings.push(...result.findings);
    notes.push(...result.notes);
  }
  return verdict(findings, notes, 'this command');
}

/**
 * `git commit`: the index against HEAD, and the branch rule. When the commit
 * takes files from the work tree (`-a`, a path, or a `git add` before it in
 * the same command), the work tree against HEAD.
 *
 * shortcut: the work tree is all of it, so a `git add` of some files also
 * checks the others. Parse the paths of `git add` if that refuses a commit
 * that is clean.
 */
async function commitCall(context, root, workTree) {
  const { files, exists } = workTree ? fromWorkTree(root) : fromIndex(root);
  const { only, sharedWorkflows } = context;
  return evaluate({ root, files, exists, branch: currentBranch(root), only, sharedWorkflows });
}

/**
 * `git push`: the commits since the merge base with origin/main, as CI checks
 * them, and the branch rule on each branch that the push names.
 */
async function pushCall(context, root, args) {
  const { only, sharedWorkflows } = context;
  const fileRules = only.filter((rule) => rule !== 'branch-name');
  const result = { findings: [], notes: [] };
  if (git(root, ['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`]) !== null) {
    try {
      const { files, exists, trailers } = fromBase(root, BASE);
      const base = await evaluate({ root, files, exists, branch: null, only: fileRules, sharedWorkflows, trailers });
      result.findings.push(...base.findings);
      result.notes.push(...base.notes);
    } catch (error) {
      if (!(error instanceof UsageError)) throw error;
      result.notes.push(error.message);
    }
  }
  if (!only.includes('branch-name')) return result;
  for (const branch of pushedBranches(pushTargets(args), root)) {
    const named = await evaluate({
      root,
      files: [],
      exists: () => false,
      branch,
      only: ['branch-name'],
      sharedWorkflows,
    });
    result.findings.push(...named.findings);
    result.notes.push(...named.notes);
  }
  return result;
}

/**
 * The gate hook: before a pull request is opened, run the gate command in
 * the root of the repository, and refuse when it fails. The pull request is
 * the GitHub MCP tool, or a `gh pr create` in a shell command.
 */
function runGate(context, gate) {
  const { tool_name: tool, tool_input: toolInput, cwd } = context.input;
  let dir = null;
  if (tool === PULL_REQUEST_TOOL) dir = cwd;
  if (SHELL_TOOLS.has(tool)) {
    dir = commandsOf(field(toolInput.command, 'command'), cwd).find(({ words }) => isPullRequest(words))?.dir ?? null;
  }
  const repository = inProject(context, dir);
  if (repository === null) return pass();
  const [program, ...args] = gate;
  try {
    execFileSync(program, args, {
      cwd: repository.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 28,
    });
    return pass([`The gates passed: ${gate.join(' ')}.`]);
  } catch (error) {
    if (typeof error?.status !== 'number') throw new CannotRun(`the gate command did not start: ${error?.message}`);
    const tail = (text, count) => (text ?? '').trimEnd().split('\n').slice(-count);
    return refuse([
      `The gates failed (\`${gate.join(' ')}\` exited with ${error.status}). Make them pass, and then open ` +
        'the pull request. The last lines of the output:',
      ...tail(error.stdout, 40),
      ...tail(error.stderr, 20),
    ]);
  }
}

/** Whether the command `words` opens a pull request with the GitHub CLI. */
function isPullRequest(words) {
  return programOf(words[0]) === 'gh' && words[1] === 'pr' && (words[2] === 'create' || words[2] === 'new');
}

/** The name of the program `word`, with no directory and no `.exe`. */
function programOf(word) {
  return path.basename(word.replaceAll('\\', '/')).replace(/\.exe$/i, '');
}

/**
 * The simple commands of the shell text `text`, each as its words. It splits
 * at `;`, `&`, `|`, parentheses and new lines, removes quotes, comments,
 * redirections and here-documents, and keeps `$(…)` and `$VAR` as text.
 *
 * shortcut: it reads POSIX shell well enough to find a command name and its
 * arguments, not to run them. A `$(…)` outside quotes splits into commands
 * of its own. Use a shell parser if a command that matters is misread.
 */
export function simpleCommands(text) {
  const state = { commands: [], words: [], word: null, skip: false, heredocs: [] };
  for (let i = 0; i < text.length; i += 1) i = step(state, text, i);
  endCommand(state);
  return state.commands;
}

/** Ends the word that is open. A redirection target is dropped. */
function endWord(state) {
  if (state.word === null) return;
  if (state.skip) state.skip = false;
  else state.words.push(state.word);
  state.word = null;
}

/** Ends the command that is open. */
function endCommand(state) {
  endWord(state);
  state.skip = false;
  if (state.words.length > 0) state.commands.push(state.words);
  state.words = [];
}

/** Reads the character at `i` into `state`, and gives the index of the last character that it read. */
function step(state, text, i) {
  const c = text[i];
  if (c === '\\') {
    if (text[i + 1] !== '\n') state.word = (state.word ?? '') + (text[i + 1] ?? '');
    return i + 1;
  }
  if (c === "'") {
    const close = text.indexOf("'", i + 1);
    const end = close === -1 ? text.length : close;
    state.word = (state.word ?? '') + text.slice(i + 1, end);
    return end;
  }
  if (c === '"') return doubleQuoted(state, text, i);
  if (c === '#' && state.word === null) {
    const newline = text.indexOf('\n', i);
    return (newline === -1 ? text.length : newline) - 1;
  }
  if (c === '\n') {
    endCommand(state);
    return skipHeredocs(state, text, i);
  }
  if (c === ' ' || c === '\t' || c === '\r') {
    endWord(state);
    return i;
  }
  if (';&|()'.includes(c)) {
    endCommand(state);
    return i;
  }
  if (c === '<' || c === '>') return redirection(state, text, i);
  state.word = (state.word ?? '') + c;
  return i;
}

/** Reads the double-quoted text that opens at `i`. A backslash escapes only `"`, `\`, `$` and a backtick. */
function doubleQuoted(state, text, i) {
  let j = i + 1;
  let value = '';
  while (j < text.length && text[j] !== '"') {
    if (text[j] === '\\' && j + 1 < text.length && '"\\$`'.includes(text[j + 1])) {
      value += text[j + 1];
      j += 2;
    } else {
      value += text[j];
      j += 1;
    }
  }
  state.word = (state.word ?? '') + value;
  return j;
}

/** Reads the redirection that opens at `i`. Its file descriptor and its target are not words of the command. */
function redirection(state, text, i) {
  if (state.word !== null && /^\d+$/.test(state.word)) state.word = null;
  else endWord(state);
  if (text.startsWith('<<', i) && text[i + 2] !== '<') return heredoc(state, text, i);
  let j = i;
  while (j < text.length && '<>&|'.includes(text[j])) j += 1;
  if (text[j - 1] === '&') {
    while (j < text.length && /[\d-]/.test(text[j])) j += 1;
    return j - 1;
  }
  state.skip = true;
  return j - 1;
}

/** Reads the `<<WORD` that opens at `i`. The lines of the here-document are skipped at the next new line. */
function heredoc(state, text, i) {
  let j = i + 2;
  const strip = text[j] === '-';
  if (strip) j += 1;
  while (text[j] === ' ' || text[j] === '\t') j += 1;
  let delimiter = '';
  while (j < text.length && !/[\s;&|()<>]/.test(text[j])) {
    if (text[j] !== "'" && text[j] !== '"' && text[j] !== '\\') delimiter += text[j];
    j += 1;
  }
  state.heredocs.push({ delimiter, strip });
  return j - 1;
}

/** Skips the lines of each open here-document after the new line at `i`. */
function skipHeredocs(state, text, i) {
  let at = i;
  for (const { delimiter, strip } of state.heredocs.splice(0)) {
    for (;;) {
      const start = at + 1;
      if (start >= text.length) return text.length;
      const newline = text.indexOf('\n', start);
      const end = newline === -1 ? text.length : newline;
      const line = text.slice(start, end);
      at = end;
      if ((strip ? line.replace(/^\t+/, '') : line) === delimiter) break;
    }
  }
  return at;
}

/** The words that run a command before its name: they take the command as their argument. */
const WRAPPERS = new Set(['command', 'builtin', 'exec', 'env', 'nohup', 'time']);

/**
 * The simple commands of `text`, each with the directory that it runs in.
 * A `cd` or `pushd` changes the directory for the commands after it. The
 * directory is null when the text does not say it, for example after `cd -`.
 */
export function commandsOf(text, cwd) {
  let dir = cwd;
  const commands = [];
  for (const words of simpleCommands(text)) {
    let i = 0;
    while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || WRAPPERS.has(words[i]))) i += 1;
    const rest = words.slice(i);
    if (rest.length === 0) continue;
    if (rest[0] === 'cd' || rest[0] === 'pushd') dir = changeDirectory(dir, rest[1]);
    commands.push({ dir, words: rest });
  }
  return commands;
}

/** The directory after `cd target` in `dir`, or null when it is not known. */
function changeDirectory(dir, target) {
  if (target === undefined || target === '~') return os.homedir();
  if (target.startsWith('~/')) return path.join(os.homedir(), target.slice(2));
  if (path.isAbsolute(target)) return target;
  if (dir === null || target === '-' || target.startsWith('~') || target.includes('$')) return null;
  return path.resolve(dir, target);
}

/** The options of git before the subcommand that take the next word as their value. */
const GIT_VALUE_OPTIONS = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--super-prefix',
]);

/**
 * The git subcommand in the command `words`, its arguments, and the
 * directory that it runs in after each `-C`. Null when `words` is not git.
 */
export function gitCall(words, dir) {
  if (programOf(words[0]) !== 'git') return null;
  let where = dir;
  let i = 1;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C') where = changeDirectory(where, words[i + 1] ?? '.');
    i += GIT_VALUE_OPTIONS.has(words[i]) ? 2 : 1;
  }
  if (i >= words.length) return null;
  return { dir: where, subcommand: words[i], args: words.slice(i + 1) };
}

/** The options of `git commit` that take the next word as their value. */
const COMMIT_VALUE_OPTIONS = new Set([
  '--message',
  '--file',
  '--template',
  '--author',
  '--date',
  '--reuse-message',
  '--reedit-message',
  '--fixup',
  '--squash',
  '--cleanup',
  '--trailer',
  '--pathspec-from-file',
]);

/** Whether `git commit args` takes files from the work tree: `-a`, `--all`, or a path. */
export function commitTakesWorkTree(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') return i + 1 < args.length;
    if (arg === '--all') return true;
    if (arg.startsWith('--')) {
      if (COMMIT_VALUE_OPTIONS.has(arg)) i += 1;
    } else if (arg.startsWith('-') && arg.length > 1) {
      // A cluster such as `-am msg`: the letters are flags until the first
      // one that takes a value, and that value is the rest of the word or
      // the next word.
      for (let k = 1; k < arg.length; k += 1) {
        if (arg[k] === 'a') return true;
        if ('mFCct'.includes(arg[k])) {
          if (k === arg.length - 1) i += 1;
          break;
        }
      }
    } else {
      return true;
    }
  }
  return false;
}

/** The options of `git push` that take the next word as their value. */
const PUSH_VALUE_OPTIONS = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec']);

/** What `git push args` pushes: its refspecs, and whether it deletes or pushes the tags. */
export function pushTargets(args) {
  const positionals = [];
  let deletes = false;
  let tags = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (arg === '--delete' || (/^-[a-zA-Z]+$/.test(arg) && arg.includes('d'))) deletes = true;
    else if (arg === '--tags') tags = true;
    else if (PUSH_VALUE_OPTIONS.has(arg)) i += 1;
    else if (!arg.startsWith('-')) positionals.push(arg);
  }
  return { deletes, tags, refspecs: positionals.slice(1) };
}

/**
 * The branches that a push makes on the remote, as PR hygiene sees them. A
 * push with no refspec pushes the branch of HEAD. A tag, a deletion and a
 * ref outside `refs/heads/` are not branches.
 */
export function pushedBranches({ deletes, tags, refspecs }, root) {
  if (deletes) return [];
  const head = () => currentBranch(root);
  if (refspecs.length === 0) return tags ? [] : [head()].filter((b) => b !== null);
  const branches = [];
  for (const refspec of refspecs) {
    const spec = refspec.replace(/^\+/, '');
    const colon = spec.indexOf(':');
    const source = colon === -1 ? spec : spec.slice(0, colon);
    const target = colon === -1 ? spec : spec.slice(colon + 1);
    if (source === '' || target === '') continue;
    if (target === 'HEAD' || target === '@') {
      branches.push(head());
    } else if (target.startsWith('refs/heads/')) {
      branches.push(target.slice('refs/heads/'.length));
    } else if (!target.startsWith('refs/') && !isTag(root, target)) {
      branches.push(target);
    }
  }
  return branches.filter((b) => b !== null);
}

/** Whether `name` is a tag and not a branch in the repository at `root`. */
function isTag(root, name) {
  const has = (ref) => git(root, ['show-ref', '--verify', '--quiet', ref]) !== null;
  return has(`refs/tags/${name}`) && !has(`refs/heads/${name}`);
}
