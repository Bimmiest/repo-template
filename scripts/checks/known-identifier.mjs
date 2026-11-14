/**
 * A name between backticks in a comment is in a source file of the
 * repository (docs/code-style.md, "Code comments", rules 11 and 12). A
 * comment that names a function or a constant stays true when its value
 * changes, and this check finds the day when the name changes. Two cases
 * fail:
 *
 * - A new or changed comment line names an identifier that is in no source
 *   file after the change: a typo, or a name that is gone.
 * - A comment line anywhere names an identifier that the change removes from
 *   the last source file that had it. The comment can be in a file that the
 *   change does not touch, where a reviewer does not see it.
 *
 * Old comments that name an old name do not fail, so that a repository that
 * adopts the check keeps them, and corrects them in its own time.
 *
 * An identifier is one word of letters, digits and `_`, with a `_` between
 * two letters or digits (`REGEX_CACHE_LIMIT`), or a capital letter after a
 * small letter or a digit (`safeRegex`, `RegexCache`). Thus `npm ci`,
 * `true`, `URL` and `__dirname` are not identifiers. A span such as
 * `Cache.get()`, `cache.maxSize` or `parse(text)` is checked part by part,
 * and only the parts that are identifiers: the arguments are not checked.
 * A span with other text in it (a space, a `/`, a `-`) is not a name.
 *
 * The index is each word of the code of each tracked text file after the
 * change, and each part of each tracked path. The comments of a file whose
 * comments this check can read are not in the index, so a comment cannot
 * keep a name alive. Markdown, lockfiles and binary files are not source
 * files.
 *
 * shortcut: the comments are found with a scanner, not a parser. It knows
 * strings, template literals and regular expression literals well enough
 * for common code, and a `#` comment only at the start of a line or after a
 * space, outside quotes on that line. A misread comment can hide a name or
 * give a false finding. Change to a parser if that happens on real code.
 */

/** The code of each finding of this check. */
export const rule = 'known-identifier';

const SLASH = /\.[cm]?[jt]sx?$/;
const HASH = /(?:\.(?:ya?ml|sh|bash|py|toml)|(?:^|\/)\.githooks\/[^/.]+|(?:^|\/)Dockerfile)$/;
const LOCKFILE =
  /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|[^/]*\.lock|go\.sum)$/;
const NOT_SOURCE =
  /\.(?:md|markdown|png|jpe?g|gif|webp|avif|ico|bmp|pdf|wasm|zip|gz|tgz|br|zst|woff2?|ttf|otf|eot|mp[34]|webm|mov)$/i;
const SPAN = /`([^`\n]+)`/g;
const NAME = /^\$?([A-Za-z_]\w*(?:[.#][A-Za-z_]\w*)*)(?:\([^()]*\))?$/;
const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'yield',
  'await',
]);

/** Whether the file at `path` is a source file of the index. */
export function isSource(path) {
  return !LOCKFILE.test(path) && !NOT_SOURCE.test(path);
}

/** The comment syntax of the file at `path`: `slash` (`//` and `/* *\/`), `hash` (`#`), or null. */
export function commentKind(path) {
  if (SLASH.test(path)) return 'slash';
  if (HASH.test(path)) return 'hash';
  return null;
}

/**
 * Whether `word` is an identifier: three characters or more, with a `_`
 * between two letters or digits, or a capital after a small letter or a
 * digit. The length keeps out a placeholder such as the `vX` of `vX.Y.Z`.
 */
export function isIdentifier(word) {
  return word.length >= 3 && (/[A-Za-z0-9]_[A-Za-z0-9]/.test(word) || /[a-z0-9][A-Z]/.test(word));
}

/** The identifiers that the comment text `text` names between backticks. */
export function namesIn(text) {
  const names = [];
  for (const [, span] of text.matchAll(SPAN)) {
    const match = NAME.exec(span.trim());
    if (match === null) continue;
    for (const part of match[1].split(/[.#]/)) {
      if (isIdentifier(part) && !names.includes(part)) names.push(part);
    }
  }
  return names;
}

/** The comment lines of `text`, each with its line number from 1, and the text with no comments. */
export function split(text, kind) {
  if (kind === 'slash') return splitSlash(text);
  if (kind === 'hash') return splitHash(text);
  return { comments: [], code: text };
}

/** The `#` comments of `text`: a `#` at the start of a line or after a space, outside quotes. */
function splitHash(text) {
  const comments = [];
  const code = [];
  text.split('\n').forEach((line, index) => {
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quote !== null) {
        if (c === quote) quote = null;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
        comments.push({ line: index + 1, text: line.slice(i) });
        code.push(line.slice(0, i));
        return;
      }
    }
    code.push(line);
  });
  return { comments, code: code.join('\n') };
}

/** The `//` and `/* *\/` comments of `text`, outside strings, template literals and regular expressions. */
function splitSlash(text) {
  const state = { text, i: 0, from: 0, line: 1, counted: 0, last: '', templates: [], comments: [], code: [] };
  while (state.i < text.length) stepSlash(state);
  state.code.push(text.slice(state.from));
  return { comments: state.comments, code: state.code.join(' ') };
}

/** The line number, from 1, of the index `at` of the text. It moves forward only. */
function lineAt(state, at) {
  for (let i = state.counted; i < at; i += 1) if (state.text.charCodeAt(i) === 10) state.line += 1;
  state.counted = Math.max(state.counted, at);
  return state.line;
}

/** Records the comment from `start` to `end`, one entry for each of its lines. */
function comment(state, start, end) {
  const first = lineAt(state, start);
  state.text
    .slice(start, end)
    .split('\n')
    .forEach((text, k) => state.comments.push({ line: first + k, text }));
  state.code.push(state.text.slice(state.from, start));
  state.from = end;
  state.i = end;
}

/** Reads one token of JavaScript or TypeScript at `state.i`. */
function stepSlash(state) {
  const { text, i } = state;
  const c = text[i];
  const next = text[i + 1];
  if (c === '/' && next === '/') {
    const end = text.indexOf('\n', i);
    comment(state, i, end === -1 ? text.length : end);
  } else if (c === '/' && next === '*') {
    const end = text.indexOf('*/', i + 2);
    comment(state, i, end === -1 ? text.length : end + 2);
  } else if (c === '"' || c === "'") {
    state.i = endOfString(text, i, c);
    state.last = c;
  } else if (c === '`') {
    templatePart(state, i + 1);
  } else if (c === '/' && regexCanStart(state)) {
    state.i = endOfRegex(text, i);
    state.last = ')';
  } else if (c === '}' && state.templates.length > 0 && state.templates.at(-1) === 0) {
    state.templates.pop();
    templatePart(state, i + 1);
  } else {
    if (state.templates.length > 0 && (c === '{' || c === '}')) {
      state.templates[state.templates.length - 1] += c === '{' ? 1 : -1;
    }
    if (!/\s/.test(c)) state.last = c;
    state.i = i + 1;
  }
}

/** The index after the string that opens with `quote` at `i`. A string ends at its quote or at a new line. */
function endOfString(text, i, quote) {
  let j = i + 1;
  while (j < text.length && text[j] !== quote && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
  return Math.min(j + 1, text.length);
}

/** Reads a template literal from `j` to its end, or to a `${`, where the code goes on. */
function templatePart(state, j) {
  const { text } = state;
  let k = j;
  while (k < text.length && text[k] !== '`' && !(text[k] === '$' && text[k + 1] === '{')) {
    k += text[k] === '\\' ? 2 : 1;
  }
  if (text[k] === '$') {
    state.templates.push(0);
    state.i = k + 2;
    state.last = '{';
  } else {
    state.i = Math.min(k + 1, text.length);
    state.last = '`';
  }
}

/** Whether a `/` at `state.i` opens a regular expression, from the code before it. */
function regexCanStart(state) {
  if (state.last === '' || '(,=:[!&|?{};+-*%<>~^'.includes(state.last)) return true;
  if (!/\w/.test(state.last)) return false;
  const before = state.text.slice(Math.max(0, state.i - 12), state.i).match(/(\w+)\s*$/);
  return before !== null && REGEX_AFTER_WORD.has(before[1]);
}

/** The index after the regular expression that opens at `i`, or `i + 1` when it is a division. */
function endOfRegex(text, i) {
  let j = i + 1;
  let inClass = false;
  while (j < text.length && text[j] !== '\n') {
    const c = text[j];
    if (c === '\\') j += 1;
    else if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) break;
    j += 1;
  }
  if (text[j] !== '/') return i + 1;
  j += 1;
  while (j < text.length && /[a-z]/i.test(text[j])) j += 1;
  return j;
}

/** The comment lines of `after` that `before` does not have, as the same trimmed text. */
export function newComments(before, after, kind) {
  const old = new Map();
  if (before !== null) {
    for (const { text } of split(before, kind).comments) old.set(text.trim(), (old.get(text.trim()) ?? 0) + 1);
  }
  return split(after, kind).comments.filter(({ text }) => {
    const left = old.get(text.trim()) ?? 0;
    if (left > 0) old.set(text.trim(), left - 1);
    return left === 0;
  });
}

/** The identifiers in the code of `text`, a file at `path`. */
function identifiersOf(text, path) {
  const found = new Set();
  for (const [word] of split(text, commentKind(path)).code.matchAll(WORD)) if (isIdentifier(word)) found.add(word);
  return found;
}

/**
 * The index of `texts`, the source files after the change by path: each word
 * of their code and of their paths, and the comment lines of each file.
 */
export function buildIndex(texts) {
  const words = new Set();
  const comments = new Map();
  const add = (text) => {
    for (const [word] of text.matchAll(WORD)) words.add(word);
  };
  for (const [path, text] of texts) {
    add(path);
    const parts = split(text, commentKind(path));
    add(parts.code);
    if (parts.comments.length > 0) comments.set(path, parts.comments);
  }
  return { words, comments };
}

/** The new comment lines of `change` that name an identifier, and the identifiers that the change can remove. */
function scan(change) {
  const named = [];
  const removed = new Set();
  for (const file of change.files) {
    const before = file.status === 'added' ? null : file.before();
    const after = file.status === 'deleted' ? null : file.after();
    const kind = commentKind(file.path);
    if (after !== null && kind !== null) {
      for (const { line, text } of newComments(before, after, kind)) {
        for (const name of namesIn(text)) named.push({ file: file.path, line, name });
      }
    }
    if (before === null || !isSource(file.path)) continue;
    const kept = after === null ? new Set() : identifiersOf(after, file.path);
    for (const name of identifiersOf(before, file.path)) if (!kept.has(name)) removed.add(name);
  }
  return { named, removed };
}

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const { named, removed } = scan(change);
  if (named.length === 0 && removed.size === 0) return [];
  const index = buildIndex(change.texts(isSource));
  const findings = [];
  const seen = new Set();
  const report = (file, line, message) => {
    const key = `${file}:${String(line)}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ rule, file, line, message });
  };
  for (const { file, line, name } of named) {
    if (index.words.has(name)) continue;
    report(file, line, unknown(name));
  }
  const gone = new Set([...removed].filter((name) => !index.words.has(name)));
  if (gone.size === 0) return findings;
  for (const [file, lines] of index.comments) {
    for (const { line, text } of lines) {
      for (const name of namesIn(text)) if (gone.has(name)) report(file, line, unknown(name));
    }
  }
  return findings;
}

/** What to change for the name `name`. */
function unknown(name) {
  return (
    `\`${name}\` is in no source file of the repository. If it has a new name, write the new name. ` +
    'If it is gone, change the comment (docs/code-style.md, rule 11). If it is a name from outside the ' +
    'repository, write it with no backticks.'
  );
}
