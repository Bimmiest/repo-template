import { describe, expect, it } from 'vitest';
import { check, newDirectives } from './eslint-disable.mjs';
import { change, fileChange } from './test-builders.mjs';

// The fixtures build each directive from two parts, so that this file holds
// no directive of its own for the check to find in a diff.
const line = (body) => ['/', `/ ${body}`].join('');
const block = (body) => ['/', `* ${body} */`].join('');

describe('newDirectives', () => {
  it.each([
    ['a next-line directive', `const a = 1;\n${line('eslint-disable-next-line no-console')}\nconsole.log(a);`, [2]],
    ['a same-line directive', `foo(); ${line('eslint-disable-line')}`, [1]],
    ['a block directive for the file', `${block('eslint-disable')}\nfoo();`, [1]],
    ['a directive with a reason', line('eslint-disable-next-line x -- because'), [1]],
  ])('finds %s in a new file', (_, after, lines) => {
    expect(newDirectives(null, after)).toEqual(lines);
  });

  it('finds only the directives that the old text does not have', () => {
    const old = `${line('eslint-disable-next-line a')}\nx();`;
    const now = `${line('eslint-disable-next-line a')}\nx();\n${line('eslint-disable-next-line a')}\ny();\n  ${line('eslint-disable-next-line b')}`;
    expect(newDirectives(old, now)).toEqual([3, 5]);
  });

  it('passes a directive that only moves, and text that only names the directive', () => {
    expect(newDirectives(`a();\n${line('eslint-disable-line')}`, `  ${line('eslint-disable-line')}\na();`)).toEqual([]);
    expect(newDirectives(null, `${line('never use an eslint-disable here')}\nconst eslintDisabled = 1;`)).toEqual([]);
  });
});

describe('eslint-disable', () => {
  it.each(['src/a.ts', 'src/a.tsx', 'scripts/a.mjs', 'a.cjs', 'b.js', 'c.mts'])(
    'fails a new directive in %s',
    (path) => {
      const files = [fileChange(path, { before: 'a();', after: `a();\n${line('eslint-disable-line')}` })];
      expect(check(change(files)).map(({ rule, file, line: at }) => ({ rule, file, line: at }))).toEqual([
        { rule: 'eslint-disable', file: path, line: 2 },
      ]);
    },
  );

  it('does not read Markdown or a deleted file', () => {
    const text = line('eslint-disable');
    expect(check(change([fileChange('docs/a.md', { after: text }), fileChange('a.ts', { before: text })]))).toEqual([]);
  });
});
