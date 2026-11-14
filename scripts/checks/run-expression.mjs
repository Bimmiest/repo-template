/**
 * `${{ }}` in a `run:` block (CLAUDE.md, CONTRIBUTING "Security"). GitHub
 * pastes the value of an expression into the script before the shell parses
 * it, so a pull request title or an input that holds shell syntax runs as
 * code. Through `env:`, the shell gets the same value as data.
 *
 * zizmor's `template-injection` audit finds the expressions that it thinks an
 * attacker controls. This check refuses each one, because which context an
 * attacker controls changes with the trigger and the caller.
 */
import { isWorkflowFile, readWorkflow } from './workflow-yaml.mjs';

/** The code of each finding of this check. */
export const rule = 'run-expression';

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const findings = [];
  for (const file of change.files) {
    if (file.status === 'deleted' || !isWorkflowFile(file.path)) continue;
    const text = file.after();
    if (text === null) continue;
    for (const entry of readWorkflow(text)) {
      if (entry.key !== 'run') continue;
      for (const { line } of entry.lines.filter((l) => l.text.includes('${{'))) {
        findings.push({
          rule,
          file: file.path,
          line,
          message:
            'Move the `${{ }}` expression to the `env:` of the step, and read it in the script as "$NAME". ' +
            'GitHub pastes an expression into the script before the shell parses it.',
        });
      }
    }
  }
  return findings;
}
