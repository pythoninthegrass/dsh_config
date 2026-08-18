/**
 * REPL-only meta-commands, distinct from agent tool calls: "/"-prefixed
 * lines that the REPL handles itself and never forwards to the Agent.
 */

export const MAGIC_COMMANDS = [
	{ name: "help", help: "list these commands" },
	{ name: "history", help: "show recent input history: /history [n] (default 20)" },
	{ name: "clear", help: "clear the terminal screen" },
	{ name: "save", help: "save this session's transcript to a file: /save <path>" },
	{ name: "reload", help: "discard the current conversation and start a fresh session" },
	{ name: "exit", help: "quit the REPL" },
	{ name: "quit", help: "quit the REPL" },
];

const NAMES = new Set(MAGIC_COMMANDS.map((command) => command.name));

/**
 * @param {string} line - one submitted (post-continuation) REPL line.
 * @returns {{name: string, args: string} | null} null if `line` isn't a
 *   slash-command at all; `{name: "unknown", args}` if it is one but doesn't
 *   match a known command, so callers can report it rather than ignore it.
 */
export function parseMagicCommand(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("/")) return null;
	const body = trimmed.slice(1);
	const spaceIndex = body.search(/\s/);
	const rawName = spaceIndex === -1 ? body : body.slice(0, spaceIndex);
	const args = spaceIndex === -1 ? "" : body.slice(spaceIndex + 1).trim();
	const name = rawName.toLowerCase();
	return { name: NAMES.has(name) ? name : "unknown", args: NAMES.has(name) ? args : rawName };
}
