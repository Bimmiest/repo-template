import { describe, expect, it } from 'vitest';
import { check, floorOf, lowered, readFloors, tokenize } from './coverage-floor.mjs';
import { change, fileChange } from './test-builders.mjs';

const vitest = (floors) =>
  `export default defineConfig({\n  test: {\n    coverage: {\n      thresholds: {\n${floors}\n      },\n    },\n  },\n});\n`;
const GLOBAL = 'statements: 90, branches: 80, functions: 85, lines: 90';

const findings = (files) => check(change(files)).map(({ rule, file, line }) => ({ rule, file, line }));

describe('readFloors', () => {
  it('reads the floors and the per-glob floors, with their lines', () => {
    const text = vitest(
      "        lines: 90, // a comment: 10\n        'src/a/**': { lines: 80, perFile: true },\n        100: false,",
    );
    expect(Object.fromEntries([...readFloors(text)].map(([k, v]) => [k, v]))).toEqual({
      'thresholds.lines': { floor: 90, line: 5 },
      'thresholds.src/a/**.lines': { floor: 80, line: 6 },
    });
  });

  it('reads a Stryker break with one number in an expression, a null, and a negative floor', () => {
    const text =
      "/* thresholds: { break: 1 } */\nexport default { thresholds: { high: 92, low: 90, break: process.env.SHARD === '1' ? null : 88 } };\n" +
      'const b = { thresholds: { lines: -10, branches: null, functions: LIMIT, statements: 80 + 5, x: "{,}" } };';
    expect(Object.fromEntries([...readFloors(text)].map(([k, v]) => [k, v.floor]))).toEqual({
      'thresholds.high': 92,
      'thresholds.low': 90,
      'thresholds.break': 88,
      'thresholds(2).lines': -10,
      'thresholds(2).branches': null,
      'thresholds(2).functions': Number.NaN,
      'thresholds(2).statements': Number.NaN,
      'thresholds(2).x': Number.NaN,
    });
  });

  it('reads a JSON config', () => {
    expect([...readFloors('{ "thresholds": { "break": 70 } }').values()].map((v) => v.floor)).toEqual([70]);
  });

  it('skips a spread and a shorthand property', () => {
    expect([...readFloors('const t = { thresholds: { ...base, lines, nested: { a: 1 }, b: 2 } };').keys()]).toEqual([
      'thresholds.nested.a',
      'thresholds.b',
    ]);
  });

  it('keeps the line count through a comment and a string over more lines', () => {
    expect(tokenize('/* a\nb */ `x\ny` z').map((t) => [t.value, t.line])).toEqual([
      ['x\ny', 2],
      ['z', 3],
    ]);
  });

  it('gives undefined for a value that is not a floor', () => {
    expect(floorOf(tokenize('true'))).toBeUndefined();
  });
});

describe('lowered', () => {
  it.each([
    ['a lower floor', vitest(GLOBAL.replace('branches: 80', 'branches: 79')), 'lower'],
    ['a removed floor', vitest('statements: 90, functions: 85, lines: 90'), 'removed'],
    ['a floor set to null', vitest(GLOBAL.replace('branches: 80', 'branches: null')), 'removed'],
    ['a floor that cannot be read', vitest(GLOBAL.replace('branches: 80', 'branches: FLOOR')), 'unreadable'],
    ['a deleted config', null, 'removed'],
  ])('finds %s', (_, after, kind) => {
    expect(lowered(vitest(GLOBAL), after).map((f) => f.kind)).toEqual(after === null ? Array(4).fill(kind) : [kind]);
  });

  it.each([
    ['the same floors', vitest(GLOBAL)],
    ['a higher floor', vitest(GLOBAL.replace('lines: 90', 'lines: 95'))],
    ['a new floor', vitest(`${GLOBAL}, 'src/b/**': { lines: 70 }`)],
  ])('passes %s', (_, after) => {
    expect(lowered(vitest(GLOBAL), after)).toEqual([]);
  });

  it('passes a floor that could not be read before', () => {
    expect(lowered(vitest('lines: FLOOR'), vitest('lines: 10'))).toEqual([]);
  });
});

describe('coverage-floor', () => {
  it.each(['vitest.config.ts', 'packages/a/vitest.config.mts', 'stryker.config.mjs', 'stryker.config.json'])(
    'fails a lower floor in %s',
    (path) => {
      const files = [fileChange(path, { before: vitest('lines: 90'), after: vitest('lines: 80') })];
      expect(findings(files)).toEqual([{ rule: 'coverage-floor', file: path, line: 5 }]);
    },
  );

  it('compares a config that moves to a new extension with its old self', () => {
    const files = [
      fileChange('vitest.config.ts', { before: vitest('lines: 90') }),
      fileChange('vitest.config.mts', { after: vitest('lines: 80') }),
    ];
    expect(findings(files)).toEqual([{ rule: 'coverage-floor', file: 'vitest.config.mts', line: 5 }]);
  });

  it('fails a deleted config, and passes a new one and other files', () => {
    expect(findings([fileChange('vitest.config.ts', { before: vitest('lines: 90') })])).toEqual([
      { rule: 'coverage-floor', file: 'vitest.config.ts', line: 1 },
    ]);
    expect(findings([fileChange('vitest.config.ts', { after: vitest('lines: 1') })])).toEqual([]);
    expect(findings([fileChange('src/config.ts', { before: vitest('lines: 90'), after: vitest('lines: 1') })])).toEqual(
      [],
    );
  });
});
