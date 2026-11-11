# 0005. Each topic file has the template text first, and the repository text below one heading

- **Status:** Accepted
- **Date:** 2026-11-11
- **Issue:** #53

## Context

Each repository that comes from the template has the six topic files in
`docs/`. They hold the rules of the standard: the ASD-STE100 rules, the
comment rules, the classes of document and the line limits. Each repository
also adds its own text to them. On 2026-11-09, this number of lines in each
copy differed from the template (#53):

| File | propslab | pcre2-wasm-utf16 | shared-workflows |
|---|---|---|---|
| `docs/documentation.md` | 74 | 26 | 68 |
| `docs/code-style.md` | 78 | 8 | 56 |
| `docs/testing.md` | 113 | 100 | 44 |
| `docs/development.md` | 104 | 45 | 77 |
| `docs/dependencies.md` | 65 | 21 | 56 |
| `docs/ci.md` | 72 | 30 | 40 |

Some of these lines are local text that must differ. Some are template text
that changed in one repository only. A reader cannot tell which, because the
two are mixed. For example, in `docs/code-style.md` of pcre2-wasm-utf16, a
local sentence is inside the template rule about `!`.

Bimmiest/shared-workflows#73 proposes a check that compares the copied files
with a pinned commit of the template. If nothing marks the two kinds of
text, that check cannot include the topic files, and their rules drift.

There were three options for the mark:

1. **A heading.** The template text is first, and the local text is below
   one fixed heading. Cost: local text cannot be next to the rule that it
   changes.
2. **Two files.** The template text is a verbatim file, and a second file
   holds the local text. Cost: twelve topic files, and more rows in
   `docs/README.md`.
3. **A link.** Each repository keeps only its local text, and links to the
   template for the rules. Cost: a repository is not complete alone, and a
   private repository links to text outside it.

These constraints applied:

- The line limits and the `type:` frontmatter of each class stay as they
  are.
- A repository with no toolchain (shared-workflows, its ADR 0002) replaces
  full sections of `code-style.md` and `testing.md`. It must omit a template
  section with a reason, as `.baseline-exceptions.json` omits a file.
- The Forgejo twin of the template compares its core files with this
  repository each week. The same mark must work there.

## Decision

Option 1, a heading.

- Each of the six topic files has the text of the template first. The text
  of the repository goes below one fixed heading, `## In this repository`.
  This heading is the last `##` section of the file.
- The text above the heading stays byte for byte the text of the template.
- A deviation from a template rule goes below the heading, with its reason.
  The rule above the heading stays as it is.
- The check of Bimmiest/shared-workflows#73 will compare each `##` section
  above the heading with the same section of the pinned template commit.
- A repository omits a template section with an entry in
  `.baseline-exceptions.json` that names the `file`, the `section` and the
  `reason`. An entry for a section that exists fails, as an entry for a file
  that exists fails.

The template text must be true in each copy. Thus it links an ADR of the
template by its full URL, and writes an issue of the template as
`Bimmiest/repo-template#n`. In a copy, a relative link or a bare `#n` goes to
a record of that repository. Each rule list of the template is in a `##`
section, so that the check can compare it and a repository can omit it.

[`docs/documentation.md`](../documentation.md#the-template-text-and-the-repository-text)
gives the rules.

## Consequences

- There is one file for each topic, so the six files and their rows in
  `docs/README.md` stay as they are. A plain text compare works, also for the
  Forgejo twin.
- Each deviation is visible below the heading, with its reason. It does not
  hide inside the rule. The three deviations of propslab that
  [ADR 0004](0004-one-point-of-coverage-slack-tests-next-to-the-code-and-mutation-on-the-changed-files.md)
  names go there.
- A reader of a rule does not see a deviation next to it. The reader must
  also read the last section of the file.
- The first adoption copies the text of the template again, byte for byte,
  into the six topic files of each repository. The topic files of propslab
  keep each paragraph on one line, and the template breaks its lines at about
  78 columns. Thus a merge of the old text does not give the same bytes.
- A repository with no toolchain omits each section that it replaces with
  one exception, which gives the reason. shared-workflows does this for
  sections of `code-style.md` and `testing.md`.
- An exception omits a full section. A repository that changes a part of a
  section keeps the section, and writes a deviation below the heading.
- Until the check of Bimmiest/shared-workflows#73 is released, no check holds
  the text above the heading to the template. A reviewer does.
- To change a rule above the heading, change the template first, and then
  each copy. That is the cost of a rule that is the same in each repository.
