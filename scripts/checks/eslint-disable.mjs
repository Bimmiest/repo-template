/**
 * A lint rule is not turned off at a call site (CONTRIBUTING, "Code style").
 * A rule that is wrong for some code is turned off in the lint config, with
 * the sentence that says why, where a reviewer of the config sees it.
 *
 * Only new text fails, so that a repository that adopts the check keeps the
 * directives that it has, and removes them in its own time.
 *
 * shortcut: a line is new when the old text has fewer lines with the same
 * trimmed text, and a directive is `//` or `/*` and `eslint-disable` on one
 * line, also in a string. A directive on the line after a `/*` is not found.
 * Change to a comment parser if that form appears.
 */

/** The code of each finding of this check. */
export const rule = 'eslint-disable';

const SOURCE = /\.[cm]?[jt]sx?$/;
const DIRECTIVE = /(?:\/\/|\/\*)\s*eslint-disable\b/;

/** The line numbers, from 1, of the directives in `after` that `before` does not have. */
export function newDirectives(before, after) {
  const old = new Map();
  for (const line of (before ?? '').split(/\r?\n/)) {
    if (DIRECTIVE.test(line)) old.set(line.trim(), (old.get(line.trim()) ?? 0) + 1);
  }
  const found = [];
  after.split(/\r?\n/).forEach((line, index) => {
    if (!DIRECTIVE.test(line)) return;
    const left = old.get(line.trim()) ?? 0;
    if (left > 0) old.set(line.trim(), left - 1);
    else found.push(index + 1);
  });
  return found;
}

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const findings = [];
  for (const file of change.files) {
    if (file.status === 'deleted' || !SOURCE.test(file.path)) continue;
    const after = file.after();
    if (after === null) continue;
    for (const line of newDirectives(file.status === 'added' ? null : file.before(), after)) {
      findings.push({
        rule,
        file: file.path,
        line,
        message:
          'Remove this `eslint-disable`. Fix the code, or turn the rule off for this file in eslint.config.js, ' +
          'with the sentence that says why.',
      });
    }
  }
  return findings;
}
