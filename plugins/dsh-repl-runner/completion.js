/**
 * Tab completion for the REPL, replacing repl.start()'s default (JS-global
 * aware, useless here) completer. Four sources, tried in order against the
 * last whitespace-delimited token of the current line:
 *
 *   1. a line-initial "/token" -> known magic-command names
 *   2. an "@token" -> cwd-relative file/dir paths, "@" kept on each hit
 *   3. a token that already looks path-like (contains "/", or starts with
 *      "./", "../", or "~/") -> file/dir paths, same as above minus the "@"
 *   4. anything else -> a deduplicated prefix match against prior input
 *
 * Pure and async (directory reads are the only I/O); index.js wires this
 * into repl's two-argument completer signature.
 */

import { promises as fs } from "node:fs";
import { homedir as osHomedir } from "node:os";
import path from "node:path";

function lastToken(line) {
	const match = /(\S*)$/.exec(line);
	return match ? match[0] : "";
}

function looksLikeExplicitPath(token) {
	return token.includes("/") || token.startsWith("~/") || token === "~";
}

function splitDirAndPrefix(token) {
	if (token === "" || token.endsWith("/")) return { dirPortion: token, basePrefix: "" };
	const index = token.lastIndexOf("/");
	if (index === -1) return { dirPortion: "", basePrefix: token };
	return { dirPortion: token.slice(0, index + 1), basePrefix: token.slice(index + 1) };
}

async function completeFsPath(token, cwd, homeDir) {
	const { dirPortion, basePrefix } = splitDirAndPrefix(token);
	const expandedDir = dirPortion.startsWith("~/")
		? path.join(homeDir, dirPortion.slice(2))
		: dirPortion === "~"
			? homeDir
			: path.resolve(cwd, dirPortion || ".");
	let entries;
	try {
		entries = await fs.readdir(expandedDir, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.name.startsWith(basePrefix))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((entry) => dirPortion + entry.name + (entry.isDirectory() ? "/" : ""));
}

/**
 * @param {object} options
 * @param {string} options.line - the full input typed so far on the current line.
 * @param {string[]} [options.commandNames] - known magic-command names, without the leading "/".
 * @param {string[]} [options.history] - prior submitted inputs, most recent first.
 * @param {string} [options.cwd]
 * @param {string} [options.homeDir]
 * @returns {Promise<[string[], string]>} `[hits, matched]`, matching the repl/readline completer contract.
 */
export async function computeCompletions({
	line,
	commandNames = [],
	history = [],
	cwd = process.cwd(),
	homeDir = osHomedir(),
}) {
	const token = lastToken(line);
	const beforeToken = line.slice(0, line.length - token.length);

	if (token.startsWith("/") && /^\s*$/.test(beforeToken)) {
		const hits = commandNames.map((name) => `/${name}`).filter((candidate) => candidate.startsWith(token));
		return [hits, token];
	}

	if (token.startsWith("@")) {
		const hits = await completeFsPath(token.slice(1), cwd, homeDir);
		return [hits.map((hit) => `@${hit}`), token];
	}

	if (looksLikeExplicitPath(token)) {
		const hits = await completeFsPath(token, cwd, homeDir);
		return [hits, token];
	}

	if (token === "") return [[], token];
	const hits = [...new Set(history)].filter((entry) => entry !== token && entry.startsWith(token));
	return [hits, token];
}
