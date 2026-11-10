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
