---
type: reference
---

# Code style

The rules for the layout, the lint and the types of the code, and for code comments, with their reasons. CONTRIBUTING.md has the summary.

- **Prettier controls the layout** (`npm run format`). The configuration is
  `.prettierrc.json`. Put generated files in `.prettierignore`, with the name
  of the script that makes them.
- **ESLint finds mistakes.** The preset is typescript-eslint
  `strictTypeChecked`, with type information. Each rule that differs from
  the preset has its reason next to it in `eslint.config.js`. If a rule is
  wrong for this code, turn it off there, with a sentence that says why. Do
  not use `eslint-disable` at the call site. One deliberate exception (for
  example, a deprecated API that you use on purpose) gets an inline disable
  that says so.
- **Do not use `!` in code that ships.** Narrow the type instead: destructure
  the value, iterate instead of index, or compare with `undefined`. Tests can
  use `!`.
- **A `switch` over a union has no `default`.** Then the exhaustiveness rule
  makes a new member a compile error at each `switch`.
- **Size limits:** 100 lines for each function and a cyclomatic complexity of
  25. Blank lines and comments do not count, so continue to write the
  reasons. Tests do not have these limits.
- **Imports** are in three groups: Node built-ins, packages, then the files
  of the project. `eslint --fix` sorts them.
- **A layer that must stay pure** (for example a simulation engine or a
  parser) gets a `no-restricted-imports` block. The block names what the
  layer must not import, and why. A test lints a real import line against
  the rule, so that a change to the configuration cannot stop the rule
  without a failure. `eslint.config.js` has a commented example of the block.
- **When you adopt a rule over existing code**, list the findings of that
  day in an allowlist, by file and by rule. A test holds the list. New
  code gets no exceptions. The list only gets shorter. When you fix a listed
  finding, lower its count in the same change.
- **TypeScript** is strict, with the extra flags in `tsconfig.base.json`.
  Each flag has its reason. Pin `typescript` with `~`, not `^`: TypeScript
  does not follow semantic versioning, and it moves with typescript-eslint.

## Code comments

The code tells the reader what it does. A comment tells the reader what the
code cannot tell. These rules apply to new code and to the code that you
change. They come from the Google style guides, *Clean Code*, *Code Complete*,
*A Philosophy of Software Design* and the Stack Overflow guide to code
comments (2021).

1. **A comment says why:** the constraint, the rule from a specification, or
   the failure that the code prevents. Do not repeat what the code does.
2. **Write the comment for the code as it is now.** Do not tell the history
   of a change ("now", "before", "changed to"). The commit message has the
   history. If the history explains a decision, link it: `(#123)` or
   `See docs/adr/NNNN-title.md.`
3. **Each exported function, class, type and constant has a TSDoc comment**
   (`/** … */`). It says what the export does for the caller, and what it
   promises. It does not say how.
4. **If a comment is difficult to write, make the code clearer first.** Then
   write the comment for the part that is still not clear.
5. **Use the same quantity of comments as the file that you change.**
6. **Put the reason next to the code that it explains.** The comment at the
   top of a file says what the file is for, and what it does not do.
7. **Link the source of a fact:** the section of a specification, the origin
   of copied code, or the issue of the bug that the code prevents.
8. **Do not keep code in a comment.** Git keeps the old version.
9. **A TODO names its issue:** `TODO(#123): what is not done.`
10. **A shortcut with a known limit says so:**
    `shortcut: <the limit>, <when to change it>.`
11. **When your change makes a comment false, change the comment in the same
    commit.**

`npm run lint` finds the rules 8 and 9: code in a `//` comment, and a TODO,
FIXME or XXX that has no issue (`scripts/eslint-comments.mjs`). A reviewer
finds the other rules.
