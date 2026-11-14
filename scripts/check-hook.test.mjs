import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyEdit,
  commandsOf,
  commitTakesWorkTree,
  gitCall,
  PULL_REQUEST_TOOL,
  pushedBranches,
  pushTargets,
  simpleCommands,
} from './check-hook.mjs';
import { run } from './check.mjs';
import {
  CONFIG,
  DISABLE,
  git,
  removeTempDirs,
  repository,
  sharedWorkflows,
  tempDir,
  WORKFLOW,
  write,
} from './test-repository.mjs';

afterEach(removeTempDirs);

/** Runs the hook of `argv` on the PreToolUse input of `tool` in the repository `root`. */
function runHook(root, { tool, input, cwd = root, argv = ['--hook'], project = root }) {
  const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, cwd });
  return run(argv, cwd, { stdin, project });
}

/** The rule of each finding in the stderr of a refusal. The first line says what refused the call. */
const rules = ({ err }) => err.slice(1).map((line) => /(?:^|: )([a-z-]+): /.exec(line)?.[1]);

describe('simpleCommands', () => {
  it('splits at the operators of the shell, and removes the quotes', () => {
    expect(simpleCommands(`a 'b c' "d \\"e\\"" f\\ g && h; i | j || k & l\nm (n)`)).toEqual([
      ['a', 'b c', 'd "e"', 'f g'],
      ['h'],
      ['i'],
      ['j'],
      ['k'],
      ['l'],
      ['m'],
      ['n'],
    ]);
  });

  it('removes comments, redirections and here-documents', () => {
    const text = [
      'git commit -F - <<-"EOF" 2>&1 >/dev/null # a comment',
      '\tgit push --force in the message',
      '\tEOF',
      'echo a > out.txt 2> err.txt < in.txt <<< word',
      'cat <<EOF',
      'EOF',
    ].join('\n');
    expect(simpleCommands(text)).toEqual([['git', 'commit', '-F', '-'], ['echo', 'a'], ['cat']]);
  });

  it('keeps a $(…) in double quotes as text, and ends at an open quote', () => {
    expect(simpleCommands('git commit -m "$(cat <<\'EOF\'\nmsg; git push\nEOF\n)"')).toEqual([
      ['git', 'commit', '-m', "$(cat <<'EOF'\nmsg; git push\nEOF\n)"],
    ]);
    expect(simpleCommands("echo 'open")).toEqual([['echo', 'open']]);
    expect(simpleCommands('# only a comment')).toEqual([]);
  });
});

describe('commandsOf and gitCall', () => {
  it('follows cd, and removes assignments and wrappers', () => {
    expect(commandsOf('cd sub && FOO=1 command git push; cd /abs; cd -; ls', '/repo')).toEqual([
      { dir: '/repo/sub', words: ['cd', 'sub'] },
      { dir: '/repo/sub', words: ['git', 'push'] },
      { dir: '/abs', words: ['cd', '/abs'] },
      { dir: null, words: ['cd', '-'] },
      { dir: null, words: ['ls'] },
    ]);
    expect(commandsOf('cd; pushd ~/x; cd rel', '/repo').map((c) => c.dir)).toEqual([
      os.homedir(),
      path.join(os.homedir(), 'x'),
      path.join(os.homedir(), 'x', 'rel'),
    ]);
  });

  it('finds the subcommand of git after its global options, and each -C', () => {
    expect(gitCall(['git', '-C', 'a', '-c', 'x=y', '--no-pager', '-C', 'b', 'push', 'origin'], '/r')).toEqual({
      dir: '/r/a/b',
      subcommand: 'push',
      args: ['origin'],
    });
    expect(gitCall(['/usr/bin/git', 'commit'], '/r')).toMatchObject({ subcommand: 'commit' });
    expect(gitCall(['git', '--version'], '/r')).toBeNull();
    expect(gitCall(['gitk'], '/r')).toBeNull();
  });
});

describe('commitTakesWorkTree, pushTargets and pushedBranches', () => {
  it.each([
    [['-m', 'msg'], false],
    [['-m', '-a msg'], false],
    [['--message', 'x', '-v'], false],
    [['-am', 'msg'], true],
    [['-ma'], false],
    [['--all'], true],
    [['-m', 'msg', 'src/a.ts'], true],
    [['-m', 'msg', '--'], false],
    [['--', 'a.ts'], true],
  ])('git commit %j takes the work tree: %s', (args, expected) => {
    expect(commitTakesWorkTree(args)).toBe(expected);
  });

  it('reads the refspecs of a push, and its options', () => {
    expect(pushTargets(['-u', '--repo', 'x', 'origin', 'a', '+b:refs/heads/c'])).toEqual({
      deletes: false,
      tags: false,
      refspecs: ['a', '+b:refs/heads/c'],
    });
    expect(pushTargets(['origin', '--delete', 'a'])).toMatchObject({ deletes: true });
    expect(pushTargets(['-fd', 'origin', 'a'])).toMatchObject({ deletes: true });
    expect(pushTargets(['--tags', 'origin', '--', 'x'])).toEqual({ deletes: false, tags: true, refspecs: ['x'] });
  });

  it('names the branches that a push makes on the remote', () => {
    const root = repository();
    git(root, 'checkout', '-q', '-b', 'feature/x-1');
    git(root, 'tag', 'v1.0.0');
    const branches = (args) => pushedBranches(pushTargets(args), root);
    expect(branches([])).toEqual(['feature/x-1']);
    expect(branches(['origin'])).toEqual(['feature/x-1']);
    expect(branches(['origin', 'HEAD', 'a:b', 'x:refs/heads/c', 'v1.0.0', 'x:refs/tags/t', ':gone'])).toEqual([
      'feature/x-1',
      'b',
      'c',
    ]);
    expect(branches(['--tags', 'origin'])).toEqual([]);
    expect(branches(['--delete', 'origin', 'a'])).toEqual([]);
  });
});

describe('applyEdit', () => {
  it('replaces the first match, or each match with replace_all', () => {
    const edit = { old_string: 'a', new_string: 'b' };
    expect(applyEdit('a a', edit)).toBe('b a');
    expect(applyEdit('a a', { ...edit, replace_all: true })).toBe('b b');
    expect(applyEdit('$& a', { old_string: 'a', new_string: '$&' })).toBe('$& $&');
  });

  it('gives null when the edit does not apply, so that the tool reports it', () => {
    expect(applyEdit('a', { old_string: 'x', new_string: 'y' })).toBeNull();
    expect(applyEdit(null, { old_string: 'x', new_string: 'y' })).toBeNull();
    expect(applyEdit(null, { old_string: '', new_string: 'y' })).toBe('y');
  });
});

describe('--hook, Write and Edit', () => {
  it('refuses a Write that breaks a rule, against HEAD', async () => {
    const root = repository();
    const input = { file_path: path.join(root, 'src/a.ts'), content: `export const a = 1;\n${DISABLE}\n` };
    const result = await runHook(root, { tool: 'Write', input });
    expect(result.code).toBe(2);
    expect(rules(result)).toEqual(['eslint-disable']);
    expect(result.err[1]).toMatch(/^src\/a\.ts:2: /);
    expect(await runHook(root, { tool: 'Write', input: { ...input, content: 'export const a = 2;\n' } })).toMatchObject(
      {
        code: 0,
      },
    );
  });

  it('passes the second edit of a new ADR, which HEAD does not have', async () => {
    const root = repository();
    const adr = path.join(root, 'docs/adr/0002-y.md');
    write(root, { 'docs/adr/0002-y.md': '# 0002. Y\n\n- **Status:** Accepted\n\nOld.\n' });
    const input = { file_path: adr, old_string: 'Old.', new_string: 'New.' };
    expect(await runHook(root, { tool: 'Edit', input })).toMatchObject({ code: 0 });
    const accepted = { file_path: path.join(root, 'docs/adr/0001-x.md'), old_string: 'The rule.', new_string: 'X.' };
    expect(rules(await runHook(root, { tool: 'Edit', input: accepted }))).toEqual(['accepted-adr']);
  });

  it('applies an Edit to the file on disk, with and without replace_all', async () => {
    const root = repository();
    write(root, { 'src/b.ts': 'export const b = 1;\n// x\n// x\n' });
    const input = { file_path: path.join(root, 'src/b.ts'), old_string: '// x', new_string: DISABLE };
    expect(rules(await runHook(root, { tool: 'Edit', input }))).toEqual(['eslint-disable']);
    const all = await runHook(root, { tool: 'Edit', input: { ...input, replace_all: true } });
    expect(rules(all)).toEqual(['eslint-disable', 'eslint-disable']);
  });

  it('refuses an Edit that adds ${{ }} to a run:, or lowers a floor', async () => {
    const root = repository();
    const workflow = {
      file_path: path.join(root, '.github/workflows/ci.yml'),
      old_string: 'echo ok',
      new_string: 'echo ${{ github.head_ref }}',
    };
    expect(rules(await runHook(root, { tool: 'Edit', input: workflow }))).toEqual(['run-expression']);
    const floor = { file_path: path.join(root, 'vitest.config.ts'), old_string: '90', new_string: '80' };
    expect(rules(await runHook(root, { tool: 'Edit', input: floor }))).toEqual(['coverage-floor']);
  });

  it('passes an Edit whose old string is not in the file, and a file of a different repository', async () => {
    const root = repository();
    const missing = { file_path: path.join(root, 'src/a.ts'), old_string: 'nowhere', new_string: DISABLE };
    expect(await runHook(root, { tool: 'Edit', input: missing })).toMatchObject({ code: 0 });
    const other = repository();
    const input = { file_path: path.join(other, 'src/new/deep.ts'), content: `${DISABLE}\n` };
    expect(await runHook(root, { tool: 'Write', input })).toMatchObject({ code: 0 });
    expect(await runHook(root, { tool: 'Write', input: { file_path: '/nowhere/x.ts', content: '' } })).toMatchObject({
      code: 0,
    });
  });

  it('checks a file in a worktree of the repository', async () => {
    const root = repository();
    const worktree = path.join(tempDir(), 'wt');
    git(root, 'worktree', 'add', '-q', '-b', 'feature/x-1', worktree);
    const input = { file_path: path.join(worktree, 'src/a.ts'), content: `${DISABLE}\n` };
    expect(rules(await runHook(root, { tool: 'Write', input, cwd: worktree }))).toEqual(['eslint-disable']);
  });
});

describe('--hook, Bash', () => {
  it('checks the index at git commit, and the work tree after a git add', async () => {
    const root = repository();
    write(root, { 'src/a.ts': `${DISABLE}\n` });
    const commit = (command) => runHook(root, { tool: 'Bash', input: { command } });
    expect(await commit('git commit -m "x"')).toMatchObject({ code: 0 });
    expect(rules(await commit('git add -A && git commit -m "x"'))).toEqual(['eslint-disable']);
    expect(rules(await commit('git commit -am "x"'))).toEqual(['eslint-disable']);
    git(root, 'add', 'src/a.ts');
    expect(rules(await commit('cd src && git commit -m "x" 2>&1'))).toEqual(['eslint-disable']);
  });

  it('checks the branch at git commit, with the pattern of PR hygiene', async () => {
    const root = repository();
    git(root, 'checkout', '-q', '-b', 'claude/x');
    const argv = ['--hook', '--shared-workflows', sharedWorkflows()];
    const result = await runHook(root, { tool: 'Bash', input: { command: 'git commit -m x' }, argv });
    expect(rules(result)).toEqual(['branch-name']);
  });

  it('checks the branch of git -C x push, and the change since origin/main', async () => {
    const root = repository();
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(root, 'checkout', '-q', '-b', 'claude/x');
    write(root, { 'vitest.config.ts': CONFIG.replace('90', '80') });
    git(root, 'commit', '-q', '-am', 'lower');
    const argv = ['--hook', '--shared-workflows', sharedWorkflows()];
    const cwd = path.dirname(root);
    const command = `git -C ${path.basename(root)} push -u origin HEAD`;
    expect(rules(await runHook(root, { tool: 'Bash', input: { command }, cwd, argv }))).toEqual([
      'coverage-floor',
      'branch-name',
    ]);
    const renamed = `${command}:feature/ok-1`;
    expect(rules(await runHook(root, { tool: 'Bash', input: { command: renamed }, cwd, argv }))).toEqual([
      'coverage-floor',
    ]);
  });

  it('checks the branch of a push when there is no origin/main', async () => {
    const root = repository();
    const argv = ['--hook', '--shared-workflows', sharedWorkflows()];
    const input = { command: 'git push origin main:claude/y' };
    expect(rules(await runHook(root, { tool: 'Bash', input, argv }))).toEqual(['branch-name']);
  });

  it('passes a command that changes no history, and each other tool', async () => {
    const root = repository();
    write(root, { 'src/a.ts': `${DISABLE}\n` });
    git(root, 'add', '.');
    expect(await runHook(root, { tool: 'Bash', input: { command: 'npm test && git status' } })).toMatchObject({
      code: 0,
    });
    expect(await runHook(root, { tool: 'Bash', input: { command: 'echo "git commit -m x"' } })).toMatchObject({
      code: 0,
    });
    expect(await runHook(root, { tool: 'Read', input: { file_path: path.join(root, 'src/a.ts') } })).toMatchObject({
      code: 0,
    });
  });
});

describe('--hook, when it cannot run', () => {
  it.each([
    ['stdin that is not JSON', 'not json'],
    ['a JSON value that is not an object', '[]'],
    ['an input with no tool_name', '{"tool_input":{}}'],
    ['an input with no tool_input', '{"tool_name":"Write"}'],
    ['a Write with no content', '{"tool_name":"Write","tool_input":{"file_path":"/x"}}'],
    ['a Bash call with no command', '{"tool_name":"Bash","tool_input":{}}'],
  ])('fails open with exit code 1 for %s', async (_, stdin) => {
    const root = repository();
    const result = await run(['--hook'], root, { stdin, project: root });
    expect(result).toMatchObject({ code: 1, out: [] });
    expect(result.err).toHaveLength(1);
  });

  it('fails open when the project is not a git repository', async () => {
    const dir = tempDir();
    const input = { file_path: path.join(dir, 'a.ts'), content: `${DISABLE}\n` };
    expect(await runHook(dir, { tool: 'Write', input })).toMatchObject({ code: 1 });
  });
});

describe('--gate', () => {
  /** A gate command that writes a file named `ran`, and exits with `status`. */
  const gate = (status) => [
    '--gate',
    '--',
    process.execPath,
    '-e',
    `require('fs').writeFileSync('ran', ''); console.log('gate output'); process.exit(${status})`,
  ];

  it('runs the gate before the GitHub MCP tool opens a pull request, and refuses when it fails', async () => {
    const root = repository();
    const failed = await runHook(root, { tool: PULL_REQUEST_TOOL, input: {}, argv: gate(3) });
    expect(failed.code).toBe(2);
    expect(failed.err).toContain('gate output');
    expect(existsSync(path.join(root, 'ran'))).toBe(true);
    expect(await runHook(root, { tool: PULL_REQUEST_TOOL, input: {}, argv: gate(0) })).toMatchObject({ code: 0 });
  });

  it('runs the gate for gh pr create, in the root of the repository', async () => {
    const root = repository();
    const input = { command: 'cd src && gh pr create --fill' };
    expect(await runHook(root, { tool: 'Bash', input, argv: gate(1) })).toMatchObject({ code: 2 });
    expect(readFileSync(path.join(root, 'ran'), 'utf8')).toBe('');
  });

  it('does not run the gate for a different command, or outside the repository', async () => {
    const root = repository();
    expect(await runHook(root, { tool: 'Bash', input: { command: 'gh pr view' }, argv: gate(1) })).toMatchObject({
      code: 0,
    });
    const elsewhere = tempDir();
    const input = { command: 'gh pr create' };
    expect(await runHook(root, { tool: 'Bash', input, cwd: elsewhere, argv: gate(1) })).toMatchObject({ code: 0 });
    expect(existsSync(path.join(root, 'ran'))).toBe(false);
  });

  it('fails open when the gate command does not start', async () => {
    const root = repository();
    const argv = ['--gate', '--', path.join(root, 'no-such-program')];
    expect(await runHook(root, { tool: PULL_REQUEST_TOOL, input: {}, argv })).toMatchObject({ code: 1 });
  });
});

describe('the command line', () => {
  it('reads the hook input from stdin, and follows the exit codes of Claude Code', () => {
    const root = repository();
    const script = path.join(import.meta.dirname, 'check.mjs');
    const input = JSON.stringify({
      tool_name: 'Write',
      cwd: root,
      tool_input: { file_path: path.join(root, '.github/workflows/ci.yml'), content: WORKFLOW },
    });
    // The script applies the rules of its own repository, so a file of the
    // temporary repository passes, and the run proves the stdin path only.
    const options = { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
    expect(execFileSync(process.execPath, [script, '--hook'], options)).toBe('');
  });
});
