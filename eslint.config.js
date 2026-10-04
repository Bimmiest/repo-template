import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint catches mistakes; Prettier owns layout. Nothing here enforces where a
 * brace goes. Every rule that departs from the preset is beside its reason, and
 * when a rule is wrong for this codebase it is turned off here with the
 * sentence saying why, never with an `eslint-disable` at the call site.
 *
 * Type-aware (`projectService`), so the typed rules resolve each file through
 * tsconfig.json. Not for type correctness, which `tsc` owns, but for what
 * compiles and is still wrong: a promise nobody awaits, an `any` spreading, a
 * `!` nobody checked.
 */
export default defineConfig([
  // All generated: build output and the reports the test suites write.
  globalIgnores(['dist', 'coverage', 'reports', '.claude']),
  {
    files: ['**/*.{ts,mts}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // An intentionally unused identifier is prefixed `_`, the TypeScript
      // convention for implementing an interface you only partly need.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // A union gains a member and every switch over it has to name it: a
      // `default:` does not count as handling a union member, since it is
      // where the new one would silently land.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Shipped code narrows or guards instead of asserting: a `!` is a claim
      // the compiler cannot check. The test override below turns it off, where
      // `arr[0]!` after a length assertion is how a case reads its subject.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // `onClick={() => set(false)}` returns the setter's void; the rule's own
      // option exempts that shorthand and still reports a void value used
      // anywhere it could be mistaken for a result.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // Counts and offsets go into messages everywhere. Numbers stringify
      // predictably; objects, nullish values and the rest stay reported.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Test code and its support files. With noUncheckedIndexedAccess on,
    // `result[0]!` after `expect(result).toHaveLength(1)` is how a case reads
    // the thing it just asserted exists; the rule would ask for a runtime guard
    // restating the expect() beside it.
    files: ['**/*.test.{ts,mts}', 'src/test/**/*.{ts,mts}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // What makes a test a test. `expect-expect` fails a case that asserts
    // nothing (it passes whatever the code does), `no-identical-title` a case
    // whose name repeats a sibling's (one of the two is then unfindable in a
    // report, and often a copy that was never edited), and `valid-expect` an
    // `expect(...)` that is never finished or an async one that is not awaited.
    files: ['**/*.test.{ts,mts}'],
    plugins: { vitest },
    rules: {
      // A helper that asserts on the test's behalf is named `expect…`, which
      // the pattern covers, so a new one takes that name rather than an entry.
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
      'vitest/no-identical-title': 'error',
      // Vitest's expect takes a failure message as its second argument.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
    },
  },
  {
    // Maintenance scripts and this config: plain JavaScript outside every
    // tsconfig, so no type-aware rules. ESM, because package.json is
    // "type": "module".
    files: ['scripts/**/*.{js,mjs}', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    // Import order: Node built-ins, then packages, then the project's own files,
    // and no finer. Within a group the order is the author's, and blank lines
    // are Prettier's. Side-effect imports are not ordered, which matters where
    // one has to run first. The fixer moves whole declarations, so
    // `eslint --fix` applies it.
    files: ['**/*.{ts,mts,js,mjs}'],
    plugins: { 'import-x': importX },
    rules: {
      'import-x/order': [
        'error',
        { groups: ['builtin', 'external', ['parent', 'sibling', 'index']], 'newlines-between': 'ignore' },
      ],
    },
  },
  {
    // Size and branching limits for hand-written code, so a function stays a
    // sequence of named steps rather than growing into a 400-line body. Lines
    // are counted without blanks and comments: the rationale kept beside a
    // rule is not what makes a function hard to follow.
    files: ['**/*.{ts,mts}', 'scripts/**/*.{js,mjs}'],
    rules: {
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 25],
    },
  },
  {
    // Tests are exempt: a describe() callback holds a whole suite, so its
    // length counts cases, and a table of cases is not branching logic.
    files: ['**/*.test.{ts,mts,mjs}'],
    rules: {
      'max-lines-per-function': 'off',
      complexity: 'off',
    },
  },
  // A layer that must stay pure gets a block like this one, and a test that
  // lints a real import line against it so a change to the config cannot
  // quietly stop it matching (propslab #510). `patterns` with `group`, not
  // `name`: a `name` entry is an exact specifier and never matches a relative
  // path.
  //
  // {
  //   files: ['src/engine/**/*.ts'],
  //   ignores: ['src/engine/**/*.test.ts'],
  //   rules: {
  //     'no-restricted-imports': ['error', { patterns: [{ group: ['**/ui', '**/ui/**'], message: 'The engine stays UI-free.' }] }],
  //   },
  // },
]);
