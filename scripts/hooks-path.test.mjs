import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HOOKS_PATH, setHooksPath } from './hooks-path.mjs';
import { git, removeTempDirs, tempDir } from './test-repository.mjs';

afterEach(removeTempDirs);

/** A git checkout with a `.githooks` directory. */
function checkout() {
  const root = tempDir();
  git(root, 'init', '-q', '-b', 'main');
  mkdirSync(path.join(root, HOOKS_PATH));
  return root;
}

/** The hooks path of the checkout at `root`, or an empty string when it has none. */
function hooksPath(root) {
  try {
    return git(root, 'config', '--local', '--get', 'core.hooksPath').trim();
  } catch {
    return '';
  }
}

describe('setHooksPath', () => {
  it('sets the hooks path in the root of a checkout, once', () => {
    const root = checkout();
    setHooksPath(root, {});
    expect(hooksPath(root)).toBe(HOOKS_PATH);
    setHooksPath(root, {});
    expect(hooksPath(root)).toBe(HOOKS_PATH);
  });

  it('does nothing in CI', () => {
    const root = checkout();
    setHooksPath(root, { CI: 'true' });
    expect(hooksPath(root)).toBe('');
  });

  it('does nothing outside a git checkout, and in a package below the root of a checkout', () => {
    expect(() => setHooksPath(tempDir(), {})).not.toThrow();
    const root = checkout();
    const dependency = path.join(root, 'node_modules', 'new-repo');
    mkdirSync(path.join(dependency, HOOKS_PATH), { recursive: true });
    setHooksPath(dependency, {});
    expect(hooksPath(root)).toBe('');
  });

  it('does nothing when there is no .githooks', () => {
    const root = tempDir();
    git(root, 'init', '-q', '-b', 'main');
    setHooksPath(root, {});
    expect(hooksPath(root)).toBe('');
  });

  it('keeps a hooks path that a person set', () => {
    const root = checkout();
    git(root, 'config', 'core.hooksPath', '/my/hooks');
    setHooksPath(root, {});
    expect(hooksPath(root)).toBe('/my/hooks');
  });
});
