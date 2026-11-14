import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  check,
  commentKind,
  isIdentifier,
  isSource,
  namesIn,
  newComments,
  split,
} from './known-identifier.mjs';
import { change, fileChange } from './test-builders.mjs';

/** The file, line and name of each finding of `result`. */
const found = (result) =>
  result.map(({ file, line, message }) => `${file}:${String(line)}:${/`(\w+)`/.exec(message)?.[1]}`);

describe('isIdentifier and namesIn', () => {
  it.each(['REGEX_CACHE_LIMIT', 'snake_case', 'safeRegex', 'RegexCache', 'utf16Decode', 'getURL'])(
    'takes %s as an identifier',
    (word) => {
      expect(isIdentifier(word)).toBe(true);
    },
  );

  it.each(['true', 'npm', 'URL', 'JSON', '__dirname', 'vX', 'value', 'Foo'])('does not take %s', (word) => {
    expect(isIdentifier(word)).toBe(false);
  });

  it.each([
    ['one name', 'the cap is `REGEX_CACHE_LIMIT`.', ['REGEX_CACHE_LIMIT']],
    ['a call, with no check of its arguments', '`safeRegex(userText)` and `parseConf()`', ['safeRegex', 'parseConf']],
    ['each part of a member', '`RegexCache.maxSize` and `cache.get()`', ['RegexCache', 'maxSize']],
    ['a variable of the shell or the environment', '`$NODE_PATH` and `process.env.CI_MODE`', ['NODE_PATH', 'CI_MODE']],
    ['each name one time', '`fooBar` and `fooBar`', ['fooBar']],
  ])('finds %s', (_, text, names) => {
    expect(namesIn(text)).toEqual(names);
  });

  it.each([
    '`npm ci`',
    '`true`',
    '`vX.Y.Z`',
    '`scripts/check.mjs`',
    '`eslint-comments.mjs`',
    '`fooBar = 1`',
    '`Map<string, FooBar>`',
    '`--fooBar`',
    'fooBar with no backticks',
    'an open ` fooBar',
  ])('finds no name in %s', (text) => {
    expect(namesIn(text)).toEqual([]);
  });
});

describe('split', () => {
  it('finds the // and /* */ comments, with their lines, and keeps strings, templates and regular expressions', () => {
    const text = [
      'const a = \'http://x\' + "//y"; // one',
      'const b = `z // ${c /* two */} // w`;',
      'const d = /\\/\\/[/]x/g.test(e) ? f / g : h; /* three',
      '   four */ const i = 1;',
      'return /x/;',
    ].join('\n');
    const { comments, code } = split(text, 'slash');
    expect(comments).toEqual([
      { line: 1, text: '// one' },
      { line: 2, text: '/* two */' },
      { line: 3, text: '/* three' },
      { line: 4, text: '   four */' },
    ]);
    expect(code).toContain("'http://x'");
    expect(code).toContain('`z // ${c ');
    expect(code).toContain('/\\/\\/[/]x/g');
    expect(code).not.toContain('one');
  });

  it('ends a string at a new line, and reads a template inside a template', () => {
    const { comments } = split("<p>Don't</p>\n// a\nconst x = `${`${y}`}`; // b", 'slash');
    expect(comments.map((c) => c.line)).toEqual([2, 3]);
  });

  it('finds a # comment at the start of a line or after a space, outside quotes', () => {
    const text = '# one\nrun: echo "a # b" \'#c\' $# x#y # two\nkey: value';
    expect(split(text, 'hash').comments).toEqual([
      { line: 1, text: '# one' },
      { line: 2, text: '# two' },
    ]);
  });

  it('gives a file with no known comment syntax as code', () => {
    expect(split('{"fooBar": 1} // x', null)).toEqual({ comments: [], code: '{"fooBar": 1} // x' });
  });
});

describe('commentKind, isSource and newComments', () => {
  it.each([
    ['src/a.ts', 'slash'],
    ['a.mjs', 'slash'],
    ['b.tsx', 'slash'],
    ['.github/workflows/ci.yml', 'hash'],
    ['scripts/x.sh', 'hash'],
    ['.githooks/pre-commit', 'hash'],
    ['README.md', null],
    ['a.json', null],
  ])('reads the comments of %s as %s', (path, kind) => {
    expect(commentKind(path)).toBe(kind);
  });

  it.each([
    ['src/a.ts', true],
    ['a.json', true],
    ['docs/a.md', false],
    ['package-lock.json', false],
    ['sub/yarn.lock', false],
    ['pcre2.wasm', false],
    ['logo.PNG', false],
  ])('takes %s as a source file: %s', (path, source) => {
    expect(isSource(path)).toBe(source);
  });

  it('gives only the comment lines that the old text does not have, as the same trimmed text', () => {
    const before = '// a\nx();\n  // b';
    const after = '// b\n// a\n// a\nx(); // c';
    expect(newComments(before, after, 'slash')).toEqual([
      { line: 3, text: '// a' },
      { line: 4, text: '// c' },
    ]);
    expect(newComments(null, '// a', 'slash')).toEqual([{ line: 1, text: '// a' }]);
  });

  it('indexes the code and the paths, and not the comments', () => {
    const index = buildIndex(new Map([['src/fooBar.ts', 'export const BAZ_QUX = 1; // `oldName`']]));
    expect([...index.words]).toEqual(expect.arrayContaining(['fooBar', 'BAZ_QUX']));
    expect(index.words.has('oldName')).toBe(false);
    expect(index.comments.get('src/fooBar.ts')).toEqual([{ line: 1, text: '// `oldName`' }]);
  });
});

describe('known-identifier', () => {
  const LIMIT = 'export const CACHE_LIMIT = 1024;\n';

  it('fails a new comment that names an identifier in no source file', () => {
    const files = [fileChange('src/a.ts', { before: 'x();\n', after: 'x();\n// The cap is `CACHE_SIZE`.\n' })];
    expect(found(check(change(files, { texts: { 'src/cache.ts': LIMIT } })))).toEqual(['src/a.ts:2:CACHE_SIZE']);
  });

  it('passes a new comment that names an identifier of a different file, of a path or of a string', () => {
    const comment = '// `CACHE_LIMIT`, `checkHook`, `core.hooksPath` and `maxEvents`.\n';
    const files = [fileChange('src/a.ts', { after: comment })];
    const texts = {
      'src/cache.ts': LIMIT,
      'scripts/checkHook.mjs': "git(['config', 'core.hooksPath']);\n",
      'config.json': '{ "maxEvents": 1 }',
    };
    expect(check(change(files, { texts }))).toEqual([]);
  });

  it('fails a name that is only in a comment, in Markdown or in a lockfile, as they are not code', () => {
    const files = [fileChange('src/a.ts', { after: '// `oldName`\n' })];
    const texts = { 'src/b.ts': '// `oldName`\n', 'docs/a.md': 'oldName', 'package-lock.json': '"oldName"' };
    expect(found(check(change(files, { texts })))).toEqual(['src/a.ts:1:oldName']);
  });

  it('passes an old comment with an unknown name, and does not read the tree when it has nothing to check', () => {
    const files = [fileChange('src/a.ts', { before: '// `oldName`\nx();\n', after: '// `oldName`\ny();\n' })];
    const unread = {
      ...change(files),
      texts: () => {
        throw new Error('read');
      },
    };
    expect(check(unread)).toEqual([]);
  });

  it('fails a comment in a file that the change does not touch, when the change removes the name it names', () => {
    const files = [
      fileChange('src/cache.ts', { before: LIMIT, after: 'export const CACHE_MAX = 1024;\n' }),
      fileChange('src/old.ts', { before: 'export function legacyParse() {}\n' }),
    ];
    const texts = {
      'src/run.ts': '// Above `CACHE_LIMIT` entries, the cache drops the oldest.\nrun();\n',
      '.github/workflows/ci.yml': 'jobs: {} # see `legacyParse`\n',
      'docs/a.md': '`CACHE_LIMIT`',
    };
    expect(found(check(change(files, { texts })))).toEqual([
      'src/run.ts:1:CACHE_LIMIT',
      '.github/workflows/ci.yml:1:legacyParse',
    ]);
  });

  it('passes a removed name that another source file still has, and reports each place one time', () => {
    const files = [
      fileChange('src/cache.ts', { before: LIMIT, after: '' }),
      fileChange('src/run.ts', { before: 'run();\n', after: '// `CACHE_SIZE` and `CACHE_SIZE`\nrun();\n' }),
    ];
    const texts = { 'src/other.ts': 'import { CACHE_LIMIT } from "./cache";\n// `CACHE_LIMIT`\n' };
    expect(found(check(change(files, { texts })))).toEqual(['src/run.ts:1:CACHE_SIZE']);
  });

  it('fails the new comment of a removed name one time, not one time for each case', () => {
    const files = [fileChange('src/cache.ts', { before: `${LIMIT}// x\n`, after: '// `CACHE_LIMIT` is 1024.\n' })];
    expect(found(check(change(files)))).toEqual(['src/cache.ts:1:CACHE_LIMIT']);
  });
});
