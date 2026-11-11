---
type: reference
---

# Documentation

The rules for the documents, and their reasons. CONTRIBUTING.md has the
summary.

## Where each text goes

Each Markdown file has one class. The docs check holds each class to a line
limit (`maxLines` in `.docs-check.json`). When a file is over its limit, the
message says where the text goes.

| Class | Files | Limit | Holds |
|---|---|---|---|
| Entry | `README.md` | 200 | The fundamentals: what the product is, and how to start |
| Agent rules | `CLAUDE.md`, `AGENTS.md` | 80 | Only the rules that people break, and the expensive mistakes |
| Rules | `CONTRIBUTING.md` | 300 | What a contributor must do, with a summary and a link for each area |
| Policy | `SECURITY.md`, `.github/**/*.md` | 80 | The report path, and the pull request and issue forms |
| Decision | `docs/adr/*.md` | 300 | One decision: the context, the decision and the consequences |
| Topic | Each other `*.md`, mostly `docs/*.md` | 500 | One topic, with its `type:` in the frontmatter |
| Record | `CHANGELOG.md`, `CODE_OF_CONDUCT.md` | none | A log that only grows, or third-party text |

Each topic file in `docs/` opens with frontmatter that gives its type
(`docTypes` in `.docs-check.json`):

```markdown
---
type: how-to
---
```

| Type | Answers | Example |
|---|---|---|
| `tutorial` | "Teach me, from the start." | A first contribution, step by step |
| `how-to` | "How do I do this task?" | `development.md`: set up, run, and the traps |
| `reference` | "What are the facts and the rules?" | `ci.md`, `testing.md`, `code-style.md`, `dependencies.md`, this file |
| `explanation` | "Why is it like this?" | A design rationale |

Each repository has the same six topic files: `development.md`, `ci.md`,
`testing.md`, `code-style.md`, `dependencies.md` and `documentation.md`. A
repository adds other topic files for its own areas. A recipe, a trap or a
troubleshooting step goes in the topic file of its area, not in
`CONTRIBUTING.md`. If a topic file gets to its limit, split it by subtopic.

## The template text and the repository text

Each of the six topic files has two parts (template
[ADR 0005](https://github.com/Bimmiest/repo-template/blob/main/docs/adr/0005-each-topic-file-has-the-template-text-first-and-the-repository-text-below-one-heading.md)):

1. The text of the template, first. It is byte for byte the same as the
   template, at the template commit that the repository follows.
2. The text of the repository, below the heading `## In this repository`.
   This heading is fixed, and it is the last `##` section of the file.

- **Put the text of the repository below the heading:** its own rules,
  recipes, traps and examples.
- **Write a deviation below the heading, with its reason.** A deviation is a
  template rule that the repository does not follow. Name the rule, and say
  what the repository does instead. Do not edit the rule above the heading,
  because then a reader cannot see the deviation.
- **To change the text above the heading, change the template first.** Then
  copy the new text to each repository. Do not change where the lines
  break. The template breaks its lines at about 78 columns, and a paragraph
  with different line breaks differs on each line.
- **In the template text, link an ADR of the template by its full URL, and
  write an issue as `Bimmiest/repo-template#n`.** In a copy, a relative link
  or a bare `#n` goes to a different record, in that repository.
- **In the template, put each rule in a `##` section.** Then the check can
  compare the section, and a repository can omit the section by its name.

A check in shared-workflows will compare each `##` section above the heading
with the same section of the pinned template commit
(Bimmiest/shared-workflows#73). That check is not there yet. When it is
there, a repository omits a full template section with an entry in
`.baseline-exceptions.json`. The entry names the file, the section and the
reason:

```json
{
  "exceptions": [
    {
      "file": "docs/code-style.md",
      "section": "The rules",
      "reason": "The repository has no toolchain. Its rules for the scripts are below the heading (ADR 0002)."
    }
  ]
}
```

An entry for a section that exists fails, as an entry for a file that exists
fails. An entry omits a full section, not a part of it. To change a part of
a section, write a deviation below the heading.

## The index

`docs/README.md` lists each topic file in `docs/`, with one row for each
file, in path order. GitHub shows it when a reader opens `docs/`. When you
add, rename or remove a topic file, change its row there, and only there.
The docs check fails a file that has no row, a row that has no file, and a
row out of order (`docsIndex` in `.docs-check.json`). The other documents
(`CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md` and the like) are listed in
the README.

## ASD-STE100

Write each new or changed text in ASD-STE100 Simplified Technical English
(template [ADR 0002](https://github.com/Bimmiest/repo-template/blob/main/docs/adr/0002-documentation-is-simplified-technical-english-and-a-readme-keeps-to-the-fundamentals.md)).
The main rules:

- One topic in each sentence, and one instruction in each procedure step.
- A maximum of 20 words in a procedure step, and 25 words in descriptive
  text. A maximum of six sentences in a paragraph.
- Use the active voice, and the imperative for an instruction. Put a
  condition first ("If the test fails, …").
- Use simple present, past or future tenses. Do not use "-ing" forms, except
  in technical names.
- Use "must" for an obligation, "can" for an ability, and "do not" for a
  prohibition. Do not use `should`, `may`, `might` or `would`.
- Use the same word for the same thing each time. Do not leave out "the",
  "a" or "an". Use a maximum of three nouns in a row.
- Do not use phrasal verbs, contractions, semicolons in prose, or `e.g.`,
  `i.e.` and `etc.`. The docs check warns on these words in the files
  that `ste` names in `.docs-check.json`.
- Do not change code, commands, file names or product names: they are
  technical names.

## The README

**The README keeps to the fundamentals, in a maximum of 200 lines.** CI's
docs check enforces the limit (`maxLines` in `.docs-check.json`). The
README has these sections, in this order:

1. A banner, the CI, security and licence badges, the name, and one sentence
   that says what the product is.
2. **Highlights:** three to five bullets.
3. **Overview:** what the product does, how mature it is, and what it is not.
4. **Demo:** a screenshot or a short GIF, from `docs/assets/`.
5. **Usage** and **Installation:** one or two commands each.
6. **Documentation:** one line that links the index, `docs/README.md`, and a
   list of the documents at the root.
7. **Contributing and feedback**, and **Licence**.

**Put technical detail in `docs/`.** If a topic needs more than a few lines,
give it its own file in `docs/`, and a row in the index. Do not use a wiki. A
wiki change gets no review and no link check. Also, GitHub does not give a
wiki to a private repository on the Free plan.

## Other rules

- **Do not write by hand a fact that a tool can give.** Do not put test
  counts in the README: `npm test` prints them.
- **Code comments** follow [their rules](code-style.md#code-comments). For history, a
  comment points to the ADR: `See docs/adr/NNNN-title.md.`
- **Each deviation in a configuration file has its reason in the same
  file:** a changed lint rule, a tsconfig flag that is off, a Dependabot
  ignore, an `overrides` entry, or a `# zizmor: ignore[...]`.
- **`CLAUDE.md` is one screen.** It does not summarise CONTRIBUTING.md. It names
  the rules that people break, and the rules where a mistake is expensive. It
  has no status and no plan.

## In this repository

Put the text of this repository here, and each deviation from a rule above,
with its reason ([the rule](#the-template-text-and-the-repository-text)).
The template has no text of its own.
