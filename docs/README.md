---
type: reference
---

# Documentation

Each topic file in `docs/`, in path order. When you add, rename or remove a
file, change its row here: the docs check fails a file that has no row. The
documents at the root are listed in the [README](../README.md#documentation).

| Document | What it holds |
|---|---|
| [adr/README.md](adr/README.md) | The decisions, and why we made them |
| [ci.md](ci.md) | Each CI job, what makes it fail, and what to do when a check fails only in CI |
| [code-style.md](code-style.md) | The rules for the layout, the lint, the types and the code comments |
| [dependencies.md](dependencies.md) | The rules for dependencies, and how to review a Dependabot pull request |
| [development.md](development.md) | How to set up a checkout, run the gates, and the traps |
| [documentation.md](documentation.md) | Where each text goes, the line limits, the topic types and the STE rules |
| [repository-settings.md](repository-settings.md) | The repository settings that are not files, and that `settings.yml` checks each week |
| [starting-from-the-template.md](starting-from-the-template.md) | How to make a new repository from this template |
| [testing.md](testing.md) | The rules for tests |
