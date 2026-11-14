import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOptions } from './check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const settings = JSON.parse(readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

/** Each command hook of the settings, with the matcher of its group. */
const handlers = Object.values(settings.hooks).flatMap((groups) =>
  groups.flatMap(({ matcher, hooks }) => hooks.map((handler) => ({ matcher, ...handler }))),
);

describe('.claude/settings.json', () => {
  it('runs each hook in exec form, with a script of this repository that exists', () => {
    expect(handlers.length).toBeGreaterThan(0);
    for (const { type, command, args } of handlers) {
      expect(type).toBe('command');
      expect(command).toBe('node');
      const [script, ...options] = args;
      expect(script.startsWith('${CLAUDE_PROJECT_DIR}/')).toBe(true);
      const file = path.join(root, script.slice('${CLAUDE_PROJECT_DIR}/'.length));
      expect(statSync(file).isFile()).toBe(true);
      expect(() => parseOptions(options)).not.toThrow();
    }
  });

  it('gates a pull request with an npm script that exists', () => {
    const gates = handlers.filter(({ args }) => args.includes('--gate'));
    expect(gates.map((h) => h.matcher.split('|')).flat()).toEqual(
      expect.arrayContaining(['Bash', 'mcp__github__create_pull_request']),
    );
    for (const { args, timeout } of gates) {
      const [program, run, name] = args.slice(args.indexOf('--') + 1);
      expect([program, run]).toEqual(['npm', 'run']);
      expect(packageJson.scripts[name]).toBeTypeOf('string');
      expect(timeout).toBeGreaterThanOrEqual(600);
    }
  });

  it('checks Edit, Write and Bash calls', () => {
    const checked = handlers.filter(({ args }) => args.includes('--hook')).flatMap((h) => h.matcher.split('|'));
    expect(checked).toEqual(expect.arrayContaining(['Edit', 'Write', 'Bash']));
  });

  it('has deny rules for Bash only', () => {
    expect(settings.permissions.deny.length).toBeGreaterThan(0);
    for (const rule of settings.permissions.deny) expect(rule).toMatch(/^Bash\(git (tag|push) .+\)$/);
  });
});

describe('the git hooks', () => {
  it.each(['pre-commit', 'pre-push'])('%s is executable, and runs scripts that exist', (name) => {
    const file = path.join(root, '.githooks', name);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o111).not.toBe(0);
    const text = readFileSync(file, 'utf8');
    expect(text.startsWith('#!/bin/sh\n')).toBe(true);
    for (const [, script] of text.matchAll(/node (scripts\/\S+\.mjs)/g)) {
      expect(statSync(path.join(root, script)).isFile()).toBe(true);
    }
  });

  it('is installed by prepare, with a script that exists', () => {
    const [, script] = /^node (\S+)$/.exec(packageJson.scripts.prepare) ?? [];
    expect(statSync(path.join(root, script)).isFile()).toBe(true);
  });
});
