/**
 * A coverage or mutation floor only goes up (CONTRIBUTING, "Tests"). The
 * coverage ratchet and the mutation ratchet of shared-workflows compare a
 * floor with a measurement. Neither compares a floor with its old value, so a
 * lower floor and a lower measurement in one change pass both. This check
 * compares each number in each `thresholds` object of `vitest.config.*` and
 * `stryker.config.*` before and after the change, and fails on a decrease.
 *
 * The config is read as text, never imported: an import runs the code of the
 * change, and the old version has no installed dependencies to import. Thus a
 * value is read when it is a number, or an expression with one number and no
 * arithmetic, as the mutation ratchet reads
 * `break: process.env.MUTATION_SHARD === '1' ? null : 81`.
 *
 * A floor can fall for a reason that is correct: the code that it measured
 * moved out, for example to a package of its own. A `Floor-Lowered:` trailer
 * in a commit message of the change records that fall, with the file, the
 * key, the old and the new value, and the reason. The trailer must name the
 * fall exactly, and a trailer that names no fall of the change fails, so the
 * record in git stays true. A change with no commit message yet (the index, a
 * file, an edit) gets each fall that a trailer can record as a warning, with
 * the line to add, and CI enforces. See
 * docs/adr/0007-a-floor-that-falls-is-recorded-in-a-commit-trailer.md.
 *
 * shortcut: the tokenizer does not know regular expression literals, and a
 * second `thresholds` object is told from the first only by its order. Change
 * to a JavaScript parser if a config needs either.
 */
import path from 'node:path';

/** The code of each finding of this check. */
export const rule = 'coverage-floor';

const CONFIG = /^(vitest|stryker)\.config\.(?:[cm]?[jt]s|json)$/;

/** The end of the string or template literal that opens at `start`. */
function stringEnd(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1;
  return i + 1;
}

/** The kind of the token that starts at `i`, and its end. */
function tokenAt(source, i) {
  const rest = source.slice(i);
  if (rest.startsWith('//')) return { type: 'comment', end: i + (/^[^\n]*/.exec(rest)[0].length || 2) };
  if (rest.startsWith('/*')) {
    const close = source.indexOf('*/', i + 2);
    return { type: 'comment', end: close === -1 ? source.length : close + 2 };
  }
  if (/^["'`]/.test(rest)) return { type: 'string', end: stringEnd(source, i) };
  const number = /^(?:\d[\d_]*(?:\.\d+)?|\.\d+)/.exec(rest);
  if (number) return { type: 'number', end: i + number[0].length };
  const name = /^[A-Za-z_$][\w$]*/.exec(rest);
  if (name) return { type: 'name', end: i + name[0].length };
  return { type: 'punct', end: i + 1 };
}

/** The tokens of JavaScript or JSON source, with no comments and no white space, each with its line from 1. */
export function tokenize(source) {
  const tokens = [];
  let line = 1;
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) {
      if (source[i] === '\n') line += 1;
      i += 1;
      continue;
    }
    const { type, end } = tokenAt(source, i);
    const text = source.slice(i, end);
    if (type !== 'comment') {
      const value = type === 'string' ? text.slice(1, -1) : text;
      tokens.push({ type, value, line });
    }
    line += text.split('\n').length - 1;
    i = end;
  }
  return tokens;
}

/** Whether `token` is the punctuation `value`. A string that holds `,` is not. */
const is = (token, value) => token?.type === 'punct' && token.value === value;

/** The index of the token that closes the bracket at `open`. */
function closing(tokens, open) {
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    if (tokens[i].type !== 'punct') continue;
    if ('([{'.includes(tokens[i].value)) depth += 1;
    if (')]}'.includes(tokens[i].value)) depth -= 1;
    if (depth === 0) return i;
  }
  return tokens.length;
}

/**
 * A floor from the tokens of a value: a number, null for no floor, undefined
 * for a value that is not a floor (`true`, `false`), or NaN for a value that
 * the check cannot read.
 */
export function floorOf(value) {
  if (value.length === 1 && value[0].type === 'name') {
    if (value[0].value === 'null') return null;
    if (value[0].value === 'true' || value[0].value === 'false') return undefined;
  }
  const negative = value[0]?.type === 'punct' && value[0].value === '-' ? -1 : 1;
  const rest = negative === -1 ? value.slice(1) : value;
  const numbers = rest.filter((t) => t.type === 'number');
  const arithmetic = rest.some((t) => t.type === 'punct' && '+-*/%'.includes(t.value));
  if (numbers.length !== 1 || arithmetic) return Number.NaN;
  return negative * Number(numbers[0].value.replace(/_/g, ''));
}

/** Each floor of the object literal at `open`, into `out`, under the key path `prefix`. */
function readObject(tokens, open, prefix, out) {
  const close = closing(tokens, open);
  let i = open + 1;
  while (i < close) {
    const key = tokens[i];
    const valueStart = i + 2;
    if (!is(tokens[i + 1], ':') || !['name', 'string', 'number'].includes(key.type)) {
      while (i < close && !is(tokens[i], ',')) i = is(tokens[i], '{') ? closing(tokens, i) + 1 : i + 1;
      i += 1;
      continue;
    }
    const name = `${prefix}.${key.value}`;
    if (is(tokens[valueStart], '{')) {
      readObject(tokens, valueStart, name, out);
      i = closing(tokens, valueStart) + 2;
      continue;
    }
    let end = valueStart;
    while (end < close && !is(tokens[end], ',')) {
      end = ['(', '[', '{'].some((b) => is(tokens[end], b)) ? closing(tokens, end) + 1 : end + 1;
    }
    const floor = floorOf(tokens.slice(valueStart, end));
    if (floor !== undefined) out.set(name, { floor, line: key.line });
    i = end + 1;
  }
}

/** Each floor of each `thresholds` object in `source`, by key path, with its line. */
export function readFloors(source) {
  const tokens = tokenize(source);
  const out = new Map();
  let count = 0;
  tokens.forEach((token, i) => {
    if (token.value !== 'thresholds' || !is(tokens[i + 1], ':') || !is(tokens[i + 2], '{')) return;
    count += 1;
    readObject(tokens, i + 2, count === 1 ? 'thresholds' : `thresholds(${count})`, out);
  });
  return out;
}

/** Each floor that is lower in `after` than in `before`, or that `after` lost or made unreadable. */
export function lowered(before, after) {
  const old = readFloors(before);
  const now = after === null ? new Map() : readFloors(after);
  const found = [];
  for (const [key, { floor }] of old) {
    if (typeof floor !== 'number' || Number.isNaN(floor)) continue;
    const next = now.get(key);
    if (next === undefined || next.floor === null) found.push({ key, from: floor, to: null, line: 1, kind: 'removed' });
    else if (Number.isNaN(next.floor)) found.push({ key, from: floor, to: null, line: next.line, kind: 'unreadable' });
    else if (next.floor < floor) found.push({ key, from: floor, to: next.floor, line: next.line, kind: 'lower' });
  }
  return found;
}

/** The key of the commit trailer that records a fall. */
export const TRAILER = 'Floor-Lowered';

const REASON = '<the reason>';

/** The trailer line that records the fall `found` of the config `file`. */
export function trailerLine({ file, key, from, to }) {
  return `${TRAILER}: ${file} ${key} ${from} -> ${to ?? 'none'}, ${REASON}`;
}

// `<file> <key> <old> -> <new>, <reason>`. The key is lazy, so that the first
// `<number> -> ` ends it, and the reason can hold any text.
const TRAILER_VALUE = /^(\S+) (.+?) (-?\d+(?:\.\d+)?) -> (-?\d+(?:\.\d+)?|none), (\S.*)$/;

/** The fall that the trailer value `value` names, or null when the value does not have the form. */
export function parseTrailer(value) {
  const match = TRAILER_VALUE.exec(value.trim());
  if (match === null || match[5].trim() === REASON) return null;
  const [, file, key, from, to] = match;
  return { file, key, from: Number(from), to: to === 'none' ? null : Number(to) };
}

const RECORD =
  'If the fall is correct because the measured code moved out, and not because a test fails, ' +
  'add this line to a commit message, with the reason:';

const MESSAGES = {
  lower: (found) =>
    `Put \`${found.key}\` back to ${found.from}, not ${found.to}. A floor only goes up: add the tests that hold it. ` +
    `${RECORD} \`${trailerLine(found)}\``,
  removed: (found) =>
    `Put \`${found.key}: ${found.from}\` back. A floor only goes up: add the tests that hold it. ` +
    `${RECORD} \`${trailerLine(found)}\``,
  unreadable: ({ key, from }) =>
    `Write \`${key}\` as a number, or as an expression with one number in it, so that this check can compare it ` +
    `with ${from}.`,
};

const NO_MESSAGE = 'CI reads the commit messages of the pull request, and fails it when the line is not there.';

/**
 * The configs of the change, by directory and tool, with the text before and
 * after. A config that moves to a new extension in its directory, for example
 * `vitest.config.ts` to `vitest.config.mts`, is compared with its old self.
 */
function configs(files) {
  const groups = new Map();
  for (const file of files) {
    const match = CONFIG.exec(path.posix.basename(file.path));
    if (!match) continue;
    const id = `${path.posix.dirname(file.path)}/${match[1]}`;
    const group = groups.get(id) ?? { old: null, now: null };
    if (file.status !== 'added') group.old = file;
    if (file.status !== 'deleted') group.now = file;
    groups.set(id, group);
  }
  return [...groups.values()].filter((g) => g.old !== null);
}

/** Each fall of each config of the change, with the path of the config. */
function falls(files) {
  const found = [];
  for (const { old, now } of configs(files)) {
    const before = old.before();
    if (before === null) continue;
    const after = now === null ? null : now.after();
    const file = (now ?? old).path;
    found.push(...lowered(before, after).map((fall) => ({ ...fall, file })));
  }
  return found;
}

/** Whether the trailer `named` names the fall `found`, with the same numbers. */
const names = (named, found) =>
  named.file === found.file && named.key === found.key && named.from === found.from && named.to === found.to;

/** What to change in the trailer `value` that records no fall of the change. */
function unused(value, named) {
  if (named === null) {
    return (
      `Write the commit trailer \`${TRAILER}: ${value}\` as ` +
      `\`${TRAILER}: <file> <key> <old> -> <new, or none>, <the reason>\`, with a real reason.`
    );
  }
  return (
    `The commit trailer \`${TRAILER}: ${value}\` names no floor that falls in this change with these numbers. ` +
    'Correct the numbers, or remove the trailer from the commit message.'
  );
}

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const trailers = (change.trailers ?? []).map((value) => ({ value, named: parseTrailer(value), used: false }));
  const findings = [];
  for (const found of falls(change.files)) {
    const finding = { rule, file: found.file, line: found.line, message: MESSAGES[found.kind](found) };
    if (found.kind === 'unreadable') {
      findings.push(finding);
      continue;
    }
    const matches = trailers.filter((t) => t.named !== null && names(t.named, found));
    for (const t of matches) t.used = true;
    if (matches.length > 0) continue;
    const trailer = trailerLine(found);
    findings.push(
      change.trailers === null
        ? { ...finding, trailer, message: `${finding.message} ${NO_MESSAGE}`, warning: true }
        : { ...finding, trailer },
    );
  }
  for (const { value, named, used } of trailers) {
    if (!used) findings.push({ rule, file: null, line: 0, message: unused(value, named) });
  }
  return findings;
}
