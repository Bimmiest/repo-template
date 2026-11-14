/**
 * The builders of the check tests: one change, as the runner gives it to a
 * check. Each test builds its change here, so that a new field of a change
 * is added in one place.
 */

/**
 * A file of a change. `before` and `after` are the texts, or null when there
 * is no file on that side. The status follows from them.
 */
export function fileChange(path, { before = null, after = null } = {}) {
  const status = before === null ? 'added' : after === null ? 'deleted' : 'modified';
  return { path, status, before: () => before, after: () => after };
}

/**
 * A change of `files`, with no branch, and a tree that has the paths in
 * `tree`. `trailers` are the `Floor-Lowered:` values of its commit messages:
 * by default it has commit messages with none, and null gives a change with
 * no commit message yet.
 */
export function change(files, { branch = null, branchPattern = null, tree = [], trailers = [] } = {}) {
  return { files, branch, branchPattern, exists: (path) => tree.includes(path), trailers };
}
