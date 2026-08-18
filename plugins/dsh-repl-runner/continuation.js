/**
 * Decide whether a REPL input buffer looks unfinished and should keep
 * accumulating lines instead of being sent as a turn. Two triggers, matching
 * common shell/markdown conventions rather than a language grammar:
 * a trailing "\" (line continuation, like bash) or an odd number of "```"
 * fence markers (an opened-but-not-closed code block).
 */

const FENCE = "```";

function countOccurrences(haystack, needle) {
	let count = 0;
	let from = 0;
	for (let index = haystack.indexOf(needle, from); index !== -1; index = haystack.indexOf(needle, from)) {
		count++;
		from = index + needle.length;
	}
	return count;
}

function trailingBackslashCount(line) {
	let count = 0;
	for (let index = line.length - 1; index >= 0 && line[index] === "\\"; index--) count++;
	return count;
}

/**
 * @param {string} cmd - the accumulated input buffer, as passed to a repl eval().
 * @returns {boolean}
 */
export function needsContinuation(cmd) {
	const body = cmd.replace(/[\r\n]+$/, "");
	if (countOccurrences(body, FENCE) % 2 === 1) return true;
	const lastLine = body.split(/[\r\n]+/).pop() ?? "";
	return trailingBackslashCount(lastLine) % 2 === 1;
}
