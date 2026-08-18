/**
 * "!"-prefixed shell escape: a line starting with "!" runs in the user's
 * shell instead of reaching the Agent, mirroring the same convention this
 * CLI's own launcher uses for one-off shell commands.
 */

/** @param {string} line */
export function isShellEscape(line) {
	return line.trimStart().startsWith("!");
}

/** @param {string} line */
export function shellCommandBody(line) {
	return line.trim().slice(1).trim();
}
