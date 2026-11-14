#!/usr/bin/env node
/**
 * The `prepare` script of package.json: it sets `core.hooksPath` to
 * `.githooks`, so that a checkout runs the git hooks after `npm ci` (#47).
 * npm runs `prepare` at each install with scripts, so this file decides when
 * to do nothing:
 *
 * - in CI, which installs with `--ignore-scripts` and gets no `prepare` at
 *   all, and which has no use for a hook if a job installs with scripts;
 * - outside a git checkout, for example in a copy from an archive;
 * - when the package is not the root of the checkout, for example when npm
 *   installs it as a dependency inside a different repository, whose hooks
 *   path is not this package's to change;
 * - when a person set a different hooks path, here or in the global config.
 *   Then it says how to use these hooks, and keeps the setting.
 *
 * Git runs a relative hooks path from the root of each work tree, so each
 * worktree runs its own `.githooks`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The hooks path that this script sets, relative to the root of the work tree. */
export const HOOKS_PATH = '.githooks';

/** The output of `git args` in `cwd`, trimmed, or null when git fails. */
function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Sets the hooks path of the checkout at `cwd` when it is right to, and gives
 * the line that says what it did.
 *
 * @param {string} cwd  The directory of the package.
 * @param {Record<string, string | undefined>} env  The environment, for `CI`.
 */
export function setHooksPath(cwd, env) {
  if (env.CI) return 'git hooks: not set, because this is CI.';
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  if (root === null) return 'git hooks: not set, because this is not a git checkout.';
  if (realpathSync(root) !== realpathSync(cwd)) {
    return `git hooks: not set, because the package is not the root of the checkout ${root}.`;
  }
  if (!existsSync(path.join(cwd, HOOKS_PATH))) return `git hooks: not set, because there is no ${HOOKS_PATH}.`;
  const current = git(cwd, ['config', '--get', 'core.hooksPath']);
  if (current === HOOKS_PATH) return `git hooks: core.hooksPath is ${HOOKS_PATH}.`;
  if (current !== null && current !== '') {
    return (
      `git hooks: core.hooksPath is ${current}, and stays. To use the hooks of this repository, ` +
      `run \`git config core.hooksPath ${HOOKS_PATH}\`.`
    );
  }
  git(cwd, ['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  return `git hooks: core.hooksPath is now ${HOOKS_PATH} (docs/development.md#the-hooks).`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(path.resolve(process.argv[1]))).href) {
  console.error(setHooksPath(process.cwd(), process.env));
}
