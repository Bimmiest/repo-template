/**
 * The `run:` and `uses:` values of a GitHub workflow or action file, read
 * line by line. A YAML library is a dependency, and a hook runs these scripts
 * with no install (shared-workflows ADR 0002).
 *
 * The reader knows block mappings and sequences, block scalars (`|` and `>`
 * with their indicators), single-quoted, double-quoted and plain scalars over
 * one or more lines, and a comment after a value. It reads each key, not only
 * `run` and `uses`, so that the text in a block scalar or a quoted scalar of
 * another key is never read as a key.
 *
 * shortcut: a `run:` or `uses:` inside a flow mapping (`- { uses: x }`), an
 * anchor or alias, and a key in a block scalar of a sequence item other than
 * `- |` are not read. Change to a full parser if a workflow here uses one.
 */

/** A key line: the indent, the `- ` markers of sequence items, the key, and the rest of the line. */
const KEY = /^(\s*)((?:-\s+)*)([A-Za-z0-9_][\w.-]*|"[^"]*"|'[^']*')\s*:(?:\s+|$)(.*)$/;

/** A block scalar header: `|` or `>`, the indicators, and a comment. */
const BLOCK = /^[|>][0-9+-]*\s*(?:#.*)?$/;

/** A sequence item that is a block scalar, for example an item of `args:`. */
const ITEM_BLOCK = /^(\s*)-\s+[|>][0-9+-]*\s*(?:#.*)?$/;

const indentOf = (line) => /^\s*/.exec(line)[0].length;
const isBlank = (line) => line.trim() === '';

/**
 * @typedef {object} ValueLine
 * @property {number} line  The line number, from 1.
 * @property {string} text  The text of the value on that line.
 */

/**
 * @typedef {object} Entry
 * @property {'run' | 'uses'} key
 * @property {number} line  The line of the key, from 1.
 * @property {string} value  The value, without its quotes and its comment.
 * @property {string | null} comment  The comment after the value, from `#`, or null.
 * @property {ValueLine[]} lines  The value, line by line.
 * @property {string[]} parents  The keys of the mappings that hold the key, outermost first.
 */

/** The end of a block scalar whose key is at `column`: the first line that is not blank and not more indented. */
function blockEnd(lines, start, column) {
  let end = start;
  while (end < lines.length && (isBlank(lines[end]) || indentOf(lines[end]) > column)) end += 1;
  return end;
}

/** A block scalar that starts on the line after `at`. */
function readBlock(lines, at, column) {
  const end = blockEnd(lines, at + 1, column);
  const content = [];
  for (let i = at + 1; i < end; i += 1) content.push({ line: i + 1, text: lines[i] });
  while (content.length > 0 && isBlank(content.at(-1).text)) content.pop();
  return { value: content.map((l) => l.text.trim()).join('\n'), comment: null, lines: content, end };
}

/** The index in `text` after the quote that closes a scalar opened with `quote`, or -1. */
function closingQuote(text, from, quote) {
  for (let i = from; i < text.length; i += 1) {
    if (quote === '"' && text[i] === '\\') {
      i += 1;
    } else if (text[i] === quote) {
      if (quote === "'" && text[i + 1] === "'") i += 1;
      else return i;
    }
  }
  return -1;
}

/** The comment at the end of `rest`, from a `#` after white space or at the start, or null. */
function commentOf(rest) {
  const match = /(?:^|\s)(#.*)$/.exec(rest);
  return match ? match[1].trim() : null;
}

/** A quoted scalar that opens on line `at`, at offset `offset` of `rest`. */
function readQuoted(lines, at, rest) {
  const quote = rest[0];
  const parts = [];
  let text = rest;
  let from = 1;
  for (let i = at; i < lines.length; i += 1) {
    const close = closingQuote(text, from, quote);
    if (close !== -1) {
      parts.push({ line: i + 1, text: text.slice(from, close) });
      const value = parts.map((p) => p.text.trim()).join(' ');
      return { value, comment: commentOf(text.slice(close + 1)), lines: parts, end: i + 1 };
    }
    parts.push({ line: i + 1, text: text.slice(from) });
    text = lines[i + 1] ?? '';
    from = 0;
  }
  // No closing quote: YAML refuses the file, so nothing after it is read.
  return { value: parts.map((p) => p.text.trim()).join(' '), comment: null, lines: parts, end: lines.length };
}

/** A plain scalar that starts on line `at` with `rest`, and continues on the lines that are more indented. */
function readPlain(lines, at, column, rest) {
  const first = rest.replace(/(?:^|\s+)#.*$/, '').trim();
  const parts = first === '' ? [] : [{ line: at + 1, text: first }];
  let end = at + 1;
  while (end < lines.length) {
    const line = lines[end];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || indentOf(line) <= column) break;
    // A key or a sequence item under an empty value is a nested node, not text.
    if (parts.length === 0 && (KEY.test(line) || /^-(?:\s|$)/.test(trimmed))) break;
    parts.push({ line: end + 1, text: trimmed.replace(/\s+#.*$/, '') });
    end += 1;
  }
  return { value: parts.map((p) => p.text).join(' '), comment: commentOf(rest), lines: parts, end };
}

/** The value of the key on line `at`, and the index of the line after it. */
function readValue(lines, at, column, rest) {
  const trimmed = rest.trim();
  if (BLOCK.test(trimmed)) return readBlock(lines, at, column);
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return readQuoted(lines, at, trimmed);
  return readPlain(lines, at, column, trimmed);
}

/** Each `run:` and `uses:` key in `text`, in file order, in any mapping. */
export function readKeys(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const open = [];
  let i = 0;
  while (i < lines.length) {
    const item = ITEM_BLOCK.exec(lines[i]);
    if (item) {
      i = blockEnd(lines, i + 1, item[1].length);
      continue;
    }
    const match = KEY.exec(lines[i]);
    if (!match) {
      i += 1;
      continue;
    }
    const [, indent, dashes, rawKey, rest] = match;
    const column = indent.length + dashes.length;
    const key = rawKey.replace(/^(["'])(.*)\1$/, '$2');
    while (open.length > 0 && open.at(-1).column >= column) open.pop();
    const parents = open.map((o) => o.key);
    const { end, ...value } = readValue(lines, i, column, rest);
    if (key === 'run' || key === 'uses') entries.push({ key, line: i + 1, ...value, parents });
    open.push({ column, key });
    i = Math.max(end, i + 1);
  }
  return entries;
}

/**
 * The `run:` of each step, and the `uses:` of each step and each job that
 * calls a reusable workflow. A key with the same name elsewhere, for example
 * a job output `run`, is not one of these.
 */
export function readWorkflow(text) {
  return readKeys(text).filter(({ key, parents }) => {
    if (parents.at(-1) === 'steps') return true;
    return key === 'uses' && parents.length === 2 && parents[0] === 'jobs';
  });
}

/** Whether `file` is a workflow or an action file: YAML under `.github/workflows/` or `.github/actions/`. */
export function isWorkflowFile(file) {
  return /^\.github\/(?:workflows|actions)\/.+\.ya?ml$/.test(file);
}
