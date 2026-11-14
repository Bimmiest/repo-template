/**
 * The branch is `<type>/<short-description>-<issue-number>` (CONTRIBUTING,
 * "Branches"). CI's PR hygiene check enforces the rule. This check gives the
 * same verdict before the push, with the pattern of PR hygiene itself
 * (`branchPattern` in shared-workflows' pr-hygiene.mjs), which the runner
 * loads and puts in `change.branchPattern`.
 *
 * The pattern lets a branch omit the issue number, because PR hygiene then
 * asks for the `no-issue` label, and a label is not visible before the push.
 * `main` is the target of each pull request, not a branch of one.
 */

/** The code of each finding of this check. */
export const rule = 'branch-name';

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const { branch, branchPattern } = change;
  if (branch === null || branch === 'main' || branchPattern === null) return [];
  if (branchPattern.test(branch)) return [];
  return [
    {
      rule,
      file: null,
      line: 0,
      message:
        `Rename the branch \`${branch}\` to \`<type>/<short-description>-<issue-number>\`, where <type> is ` +
        'feature, fix, refactor, docs, ci or chore, and the description is lower-case kebab: ' +
        '`git branch -m <new-name>`. Open the pull request from the new name, and say so in the description.',
    },
  ];
}
