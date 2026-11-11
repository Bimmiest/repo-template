import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import config from '../eslint.config.js';

/**
 * The `no-restricted-syntax` block of the real config, so that a change to its
 * selectors cannot stop the rule without a failure here.
 */
const block = config.find((entry) => entry.rules?.['no-restricted-syntax']);

/** The rule ids that the block reports for `code` in a test file. */
function reports(code) {
  return new Linter()
    .verify(
      code,
      [
        {
          files: ['**/*.ts'],
          languageOptions: { parser: tseslint.parser, sourceType: 'module' },
          rules: { 'no-restricted-syntax': block?.rules['no-restricted-syntax'] },
        },
      ],
      { filename: 'x.test.ts' },
    )
    .map((m) => m.ruleId);
}

/**
 * Each `no-restricted-syntax` block of the real config, with its `files` and
 * `ignores`, so that the blocks merge for a file as they do in a lint run: a
 * later list for the same file replaces an earlier one.
 */
const syntaxBlocks = config
  .filter((entry) => entry.rules?.['no-restricted-syntax'])
  .map(({ files, ignores, rules }) => ({
    files,
    ...(ignores && { ignores }),
    rules: { 'no-restricted-syntax': rules['no-restricted-syntax'] },
  }));

/** The rule ids that those blocks report for `code` in `filename`. */
function reportsIn(filename, code) {
  return new Linter()
    .verify(
      code,
      [
        { files: ['**/*.{ts,mts,js,mjs}'], languageOptions: { parser: tseslint.parser, sourceType: 'module' } },
        ...syntaxBlocks,
      ],
      { filename },
    )
    .map((m) => m.ruleId);
}

describe('state that changes is not kept at module level (#55)', () => {
  it.each([
    ['src/run.ts', 'let deadline = Infinity;'],
    ['src/run.ts', 'export let count = 0;'],
    ['scripts/tool.mjs', 'let cache;'],
  ])('reports %s: %j', (file, line) => {
    expect(reportsIn(file, line)).toEqual(['no-restricted-syntax']);
  });

  it.each([
    ['src/run.ts', 'const cache = new Map();'],
    ['src/run.ts', 'export function next() { let i = 0; i += 1; return i; }'],
    ['src/run.ts', 'for (let i = 0; i < 3; i += 1) console.log(i);'],
    ['src/run.test.ts', 'let fixture; beforeEach(() => { fixture = {}; });'],
  ])('passes %s: %j', (file, line) => {
    expect(reportsIn(file, line)).toEqual([]);
  });

  it('leaves the list of the test files in force', () => {
    expect(reportsIn('src/run.test.ts', "expect(diagnostic.message).toContain('missing');")).toEqual([
      'no-restricted-syntax',
    ]);
  });
});

describe('a test asserts the code of a diagnostic, not its message', () => {
  it('applies to test files', () => {
    expect(block?.files).toEqual(['**/*.test.{ts,mts}']);
  });

  it.each([
    "expect(diagnostic.message).toContain('missing');",
    "expect(result.diagnostics[0].message).toBe('No such stanza.');",
    "expect(diagnostics).toContainEqual(expect.objectContaining({ message: expect.stringContaining('x') }));",
  ])('reports %j', (line) => {
    expect(reports(line)).toEqual(['no-restricted-syntax']);
  });

  it.each([
    "expect(diagnostic.code).toBe('missing-stanza');",
    "expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'missing-stanza', file: 'props.conf' }));",
    "expect(() => parse('')).toThrow(/empty/);",
  ])('passes %j', (line) => {
    expect(reports(line)).toEqual([]);
  });
});
