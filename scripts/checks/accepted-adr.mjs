/**
 * An accepted ADR does not change (CONTRIBUTING, "Decisions"). When a
 * decision changes, a new ADR records it, and the old one changes only its
 * status, to `Superseded by NNNN` (docs/adr/README.md, "Conventions").
 *
 * Thus a change to an ADR whose status was Accepted passes only when the
 * Status item is the one part that changes, and the new status names the ADR
 * that supersedes it. "Accepted. The coverage bullets are superseded by
 * [0003](…)" passes, as the partial form in shared-workflows ADR 0002 does. A
 * new ADR, and an ADR that is still Proposed, can change freely.
 */

/** The code of each finding of this check. */
export const rule = 'accepted-adr';

const ADR = /^docs\/adr\/\d{4}-[^/]+\.md$/;
const STATUS = /^\s*(?:[-*]\s+)?(?:\*\*)?Status:?(?:\*\*)?:?\s*(.*)$/i;
const SUPERSEDED = /superseded by\s*\[?\d{4}/i;

/**
 * The Status item of an ADR: the index of its first line, the index after
 * its last line, and its text. A line that is indented and does not start a
 * new list item continues the item. Null when the ADR has no Status line.
 */
export function statusOf(lines) {
  const start = lines.findIndex((line) => STATUS.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end]) && !/^\s*[-*]\s/.test(lines[end])) end += 1;
  const text = [STATUS.exec(lines[start])[1], ...lines.slice(start + 1, end).map((l) => l.trim())].join(' ');
  return { start, end, text };
}

/** Whether the ADR text `text` has the status Accepted. */
export function isAccepted(text) {
  const status = statusOf(text.split(/\r?\n/));
  return status !== null && /^accepted\b/i.test(status.text);
}

/** The first index where the arrays `a` and `b` differ, or -1. */
function firstDifference(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) return i;
  return -1;
}

/** The first line, from 1, where `after` differs from `before` outside the Status item, or null. */
function changeOutsideStatus(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const sa = statusOf(a);
  const sb = statusOf(b);
  if (sa === null || sb === null) return 1;
  const head = firstDifference(a.slice(0, sa.start), b.slice(0, sb.start));
  if (head !== -1) return head + 1;
  const tail = firstDifference(a.slice(sa.end), b.slice(sb.end));
  return tail === -1 ? null : sb.end + tail + 1;
}

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const findings = [];
  for (const file of change.files) {
    if (file.status === 'added' || !ADR.test(file.path)) continue;
    const before = file.before();
    if (before === null || !isAccepted(before)) continue;
    const after = file.after();
    const how =
      'To change the decision, write a new ADR, and change only the Status line of this one to ' +
      '`Superseded by [NNNN](NNNN-title.md)`.';
    if (after === null) {
      findings.push({
        rule,
        file: file.path,
        line: 1,
        message: `Restore this accepted ADR. An ADR does not change. ${how}`,
      });
      continue;
    }
    if (after === before) continue;
    const line = changeOutsideStatus(before, after);
    if (line !== null) {
      findings.push({
        rule,
        file: file.path,
        line,
        message: `Revert this edit: the ADR is Accepted, and an ADR does not change. ${how}`,
      });
      continue;
    }
    const status = statusOf(after.split(/\r?\n/));
    if (status !== null && !SUPERSEDED.test(status.text)) {
      findings.push({
        rule,
        file: file.path,
        line: status.start + 1,
        message: `The Status of an accepted ADR changes only to name the ADR that supersedes it. ${how}`,
      });
    }
  }
  return findings;
}
