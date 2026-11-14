import { describe, expect, it } from 'vitest';
import { check, floorOf, lowered, parseTrailer, readFloors, tokenize, trailerLine } from './coverage-floor.mjs';
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

describe('the Floor-Lowered trailer (#74)', () => {
  const lower = (path = 'vitest.config.ts') =>
    fileChange(path, { before: vitest(GLOBAL), after: vitest(GLOBAL.replace('branches: 80', 'branches: 76')) });
  const VALUE = 'vitest.config.ts thresholds.branches 80 -> 76, the parser moved to a package of its own (ADR 0009)';
  const run = (files, trailers) => check(change(files, { trailers }));

  it('reads the file, the key, the old and the new value, and needs a reason', () => {
    expect(parseTrailer(VALUE)).toEqual({ file: 'vitest.config.ts', key: 'thresholds.branches', from: 80, to: 76 });
    expect(parseTrailer('a/stryker.config.mjs thresholds.src/x y/**.lines 9.5 -> none, gone: 1 -> 0, ok')).toEqual({
      file: 'a/stryker.config.mjs',
      key: 'thresholds.src/x y/**.lines',
      from: 9.5,
      to: null,
    });
  });

  it.each([
    ['no reason', 'vitest.config.ts thresholds.lines 90 -> 80'],
    ['the reason of the template', 'vitest.config.ts thresholds.lines 90 -> 80, <the reason>'],
    ['no key', 'vitest.config.ts 90 -> 80, x'],
    ['no arrow', 'vitest.config.ts thresholds.lines 90 80, x'],
    ['a word for a value', 'vitest.config.ts thresholds.lines ninety -> 80, x'],
  ])('reads nothing from a trailer with %s', (_, value) => {
    expect(parseTrailer(value)).toBeNull();
  });

  it('gives the trailer line of a fall, with none for a floor that is gone', () => {
    expect(trailerLine({ file: 'f', key: 'k', from: 90, to: 80 })).toBe('Floor-Lowered: f k 90 -> 80, <the reason>');
    expect(trailerLine({ file: 'f', key: 'k', from: 90, to: null })).toBe(
      'Floor-Lowered: f k 90 -> none, <the reason>',
    );
  });

  it('passes a fall that a trailer names, also twice, and a removed floor that a trailer names with none', () => {
    expect(run([lower()], [VALUE])).toEqual([]);
    expect(run([lower()], [VALUE, VALUE])).toEqual([]);
    const removed = fileChange('vitest.config.ts', { before: vitest(GLOBAL), after: null });
    const all = ['statements 90', 'branches 80', 'functions 85', 'lines 90'].map((floor) => {
      const [metric, from] = floor.split(' ');
      return `vitest.config.ts thresholds.${metric} ${from} -> none, the code moved out`;
    });
    expect(run([removed], all)).toEqual([]);
  });

  it.each([
    ['another file', VALUE.replace('vitest.config.ts', 'a/vitest.config.ts')],
    ['another key', VALUE.replace('branches', 'lines')],
    ['another old value', VALUE.replace('80 ->', '81 ->')],
    ['another new value', VALUE.replace('-> 76', '-> 77')],
  ])('fails a fall, and the trailer, when the trailer names %s', (_, value) => {
    expect(run([lower()], [value]).map(({ file, line }) => ({ file, line }))).toEqual([
      { file: 'vitest.config.ts', line: 5 },
      { file: null, line: 0 },
    ]);
  });

  it('fails a trailer that names no fall, and a trailer that does not have the form', () => {
    const raised = fileChange('vitest.config.ts', {
      before: vitest(GLOBAL),
      after: vitest(GLOBAL.replace('80', '81')),
    });
    expect(run([raised], [VALUE, 'the floor is lower now']).map(({ file }) => file)).toEqual([null, null]);
    expect(run([], [VALUE]).map(({ rule }) => rule)).toEqual(['coverage-floor']);
  });

  it('does not let a trailer pass a floor that it cannot read', () => {
    const files = [fileChange('vitest.config.ts', { before: vitest('lines: 90'), after: vitest('lines: FLOOR') })];
    const value = 'vitest.config.ts thresholds.lines 90 -> none, x';
    expect(run(files, [value]).map(({ file }) => file)).toEqual(['vitest.config.ts', null]);
  });

  it('gives a fall as a warning with the trailer line when the change has no commit message', () => {
    const [found, ...rest] = run([lower()], null);
    expect(rest).toEqual([]);
    expect(found).toMatchObject({
      rule: 'coverage-floor',
      file: 'vitest.config.ts',
      line: 5,
      warning: true,
      trailer: 'Floor-Lowered: vitest.config.ts thresholds.branches 80 -> 76, <the reason>',
    });
    const unreadable = fileChange('vitest.config.ts', { before: vitest('lines: 90'), after: vitest('lines: X') });
    expect(run([unreadable], null)[0].warning).toBeUndefined();
  });
});
