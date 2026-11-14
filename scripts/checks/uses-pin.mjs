/**
 * Each `uses:` is pinned to a full commit SHA, with its version in a comment
 * after it (docs/standard.md, "Workflow hygiene"). A tag can move, and the
 * update bot bumps a pin only in the form `@<sha> # vX.Y.Z`.
 *
 * `./` is the one other form: a local action or workflow, at the commit of
 * the run, which shared-workflows uses for its own actions. No repository of
 * the estate uses `docker://`, so this check refuses it with the other forms.
 */
import { isWorkflowFile, readWorkflow } from './workflow-yaml.mjs';

/** The code of each finding of this check. */
export const rule = 'uses-pin';

const PINNED = /^[^\s@]+@[0-9a-f]{40}$/;
const VERSION = /^#\s*v\d+\.\d+\.\d+(?:\s.*)?$/;

/** What to change in the `uses:` value `value` with the comment `comment`, or null when it conforms. */
export function problem(value, comment) {
  if (value.startsWith('./')) return null;
  if (!PINNED.test(value)) {
    return (
      `Pin \`${value}\` to a full commit SHA, with its version in a comment: \`owner/repo@<40 hex digits> # vX.Y.Z\`. ` +
      'A tag or a branch can move. Only `./` (a local action) needs no SHA.'
    );
  }
  if (comment === null || !VERSION.test(comment)) {
    return `Add the version of the pinned commit after the SHA, as \`# vX.Y.Z\`. The update bot reads it to bump the pin.`;
  }
  return null;
}

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const findings = [];
  for (const file of change.files) {
    if (file.status === 'deleted' || !isWorkflowFile(file.path)) continue;
    const text = file.after();
    if (text === null) continue;
    for (const entry of readWorkflow(text)) {
      if (entry.key !== 'uses') continue;
      const message = problem(entry.value, entry.comment);
      if (message !== null) findings.push({ rule, file: file.path, line: entry.line, message });
    }
  }
  return findings;
}
