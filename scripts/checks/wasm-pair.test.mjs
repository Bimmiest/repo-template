import { describe, expect, it } from 'vitest';
import { change, fileChange } from './test-builders.mjs';
import { check } from './wasm-pair.mjs';

const findings = (files, tree = []) => check(change(files, { tree })).map(({ rule, file }) => ({ rule, file }));
const modified = (path) => fileChange(path, { before: 'old', after: 'new' });

describe('wasm-pair', () => {
  it.each([
    ['a changed binary', [modified('pcre2.wasm')], ['pcre2.wasm', 'pcre2.wasm.sha256'], 'pcre2.wasm'],
    ['a new binary with no checksum', [fileChange('pcre2.wasm', { after: 'x' })], ['pcre2.wasm'], 'pcre2.wasm'],
    ['a changed checksum', [modified('pcre2.wasm.sha256')], ['pcre2.wasm', 'pcre2.wasm.sha256'], 'pcre2.wasm.sha256'],
    ['a removed binary', [fileChange('pcre2.wasm', { before: 'x' })], ['pcre2.wasm.sha256'], 'pcre2.wasm'],
    ['a binary in a directory', [modified('dist/pcre2.wasm')], ['dist/pcre2.wasm'], 'dist/pcre2.wasm'],
    [
      'a binary whose checksum changes in another directory',
      [modified('pcre2.wasm'), modified('a/pcre2.wasm.sha256')],
      ['pcre2.wasm.sha256'],
      'pcre2.wasm',
    ],
  ])('fails %s alone', (_, files, tree, file) => {
    expect(findings(files, tree)).toEqual([{ rule: 'wasm-pair', file }]);
  });

  it.each([
    ['both files', [modified('pcre2.wasm'), modified('pcre2.wasm.sha256')], ['pcre2.wasm', 'pcre2.wasm.sha256']],
    ['a checksum with no binary in the tree', [modified('pcre2.wasm.sha256')], ['pcre2.wasm.sha256']],
    ['both removed', [fileChange('pcre2.wasm', { before: 'x' }), fileChange('pcre2.wasm.sha256', { before: 'y' })], []],
    ['a binary removed with no checksum', [fileChange('pcre2.wasm', { before: 'x' })], []],
    ['a pair in a directory', [modified('a/pcre2.wasm'), modified('a/pcre2.wasm.sha256')], ['a/pcre2.wasm']],
    ['other files', [modified('src/pcre2.ts'), modified('other.wasm')], []],
  ])('passes %s', (_, files, tree) => {
    expect(findings(files, tree)).toEqual([]);
  });
});
