/**
 * `pcre2.wasm` and `pcre2.wasm.sha256` change together (the CLAUDE.md of
 * pcre2-wasm-utf16). The consumers check the binary against the checksum, so
 * a change to one of the two alone breaks each install of the next release.
 *
 * A directory that has only the checksum, as propslab-engine records the
 * checksum of the binary that it installs, can change the checksum alone.
 */
import path from 'node:path';

/** The code of each finding of this check. */
export const rule = 'wasm-pair';

const WASM = 'pcre2.wasm';
const SUM = 'pcre2.wasm.sha256';

/** @param {import('../check.mjs').Change} change */
export function check(change) {
  const changed = new Map(change.files.map((f) => [f.path, f]));
  const findings = [];
  for (const file of change.files) {
    const name = path.posix.basename(file.path);
    if (name !== WASM && name !== SUM) continue;
    const other = path.posix.join(path.posix.dirname(file.path), name === WASM ? SUM : WASM);
    if (changed.has(other)) continue;
    // A new or changed binary needs its checksum. A changed checksum needs
    // the binary only where the binary is, and a removed binary only where
    // its checksum stays.
    const needed = name === WASM ? file.status !== 'deleted' || change.exists(other) : change.exists(other);
    if (!needed) continue;
    findings.push({
      rule,
      file: file.path,
      line: 1,
      message:
        `Change \`${other}\` in the same change. Build both with \`npm run build:wasm\`, and commit ` +
        '`pcre2.wasm` and `pcre2.wasm.sha256` together.',
    });
  }
  return findings;
}
