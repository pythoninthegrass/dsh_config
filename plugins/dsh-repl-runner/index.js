import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import repl from "node:repl";
import z from "@deepseek-ai/schemastery";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { summarizeTurn } from "./summarize-turn.js";
import { needsContinuation } from "./continuation.js";
import { MAGIC_COMMANDS, parseMagicCommand } from "./magic-commands.js";
import { isShellEscape, shellCommandBody } from "./shell-escape.js";
import { computeCompletions } from "./completion.js";
import { resolveDshHome, historyFilePath, transcriptFilePath } from "./paths.js";

/**
 * dsh-repl-runner — an interactive, multi-turn direct Agent driver built on
 * node:repl. See docs/dsh-repl-runner-internals.md for why.
 */

const name = "repl-runner";
const inject = ["agentDefaultModel", "agents", "sessions"];
const Config = z.object({});

const internals = {
	stdin: process.stdin,
	stdout: process.stdout,
	stderr: process.stderr,
};

async function runRepl(ctx, io) {
	await ctx.get("loader")?.await();
	const agents = ctx.get("agents");
	const defaultModel = ctx.get("agentDefaultModel");
	const sessions = ctx.get("sessions");
	if (agents === void 0 || defaultModel === void 0 || sessions === void 0) return;

	const dshHome = resolveDshHome();
	const useColor = Boolean(io.stdout.isTTY) && !process.env.NO_COLOR;
	const colorize = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
	// Truecolor, not indexed — see docs/dsh-repl-runner-internals.md.
	const FUCHSIA = "38;2;255;0;255";

	async function createAgent() {
		const selection = defaultModel.currentSelection();
		const { agent: created } = await agents.create({
			sessionId: SessionId(`session-${randomUUID()}`),
			meta: { cwd: process.cwd() },
			agentOptions: { provider: selection.provider, model: selection.model },
			setup: (agentCtx) => {
				installModelSelection(agentCtx, { current: selection, assembled: void 0 });
			},
		});
		await created.whenIdle();
		return created;
	}

	let agent = await createAgent();
	let turnNumber = 1;
	let transcriptPath = transcriptFilePath(agent.session.id, dshHome);
	mkdirSync(dirname(transcriptPath), { recursive: true });

	function appendTranscript(line) {
		appendFileSync(transcriptPath, `[${new Date().toISOString()}] ${line}\n`);
	}

	function promptText(color = "36") {
		return `${colorize(color, `[${turnNumber}]>`)} `;
	}

	function helpText() {
		const lines = MAGIC_COMMANDS.map((command) => `  /${command.name}  ${command.help}`);
		lines.push("  !<command>  run <command> in your shell (only Esc cancels the line)");
		lines.push("  @<path>  tab-completes a cwd-relative file or directory");
		lines.push('  bare "exit"/"quit" and Ctrl-D also quit');
		return `${lines.join("\n")}\n`;
	}

	// Streams text-delta chunks live — see docs/dsh-repl-runner-internals.md.
	let streamed = false;
	let thinking = false;
	// Whether the live prompt bracket is drawn fuchsia (shell-escape mode).
	let shellPromptActive = false;
	ctx.on("session/event", (session, event) => {
		if (session !== agent.session || event.type !== "assistant/chunk") return;
		const { chunk } = event.data;
		if (chunk.type === "reasoning-delta") {
			if (!thinking) {
				io.stdout.write("(thinking...)\n");
				thinking = true;
			}
		} else if (chunk.type === "text-delta") {
			io.stdout.write(chunk.text);
			streamed = true;
		}
	});

	// Serializes turns — REPLServer doesn't wait for eval() to finish before
	// starting the next on burst input. See docs/dsh-repl-runner-internals.md.
	let queue = Promise.resolve();
	function enqueue(fn) {
		queue = queue.then(fn).catch((error) => {
			io.stderr.write(`dsh: ${error instanceof Error ? error.message : String(error)}\n`);
		});
		return queue;
	}

	async function runShellCommand(commandBody) {
		shellPromptActive = false;
		if (commandBody === "") return;
		const shell = process.env.SHELL || "/bin/sh";
		const canToggleRawMode = typeof io.stdin.setRawMode === "function";
		r.pause();
		if (canToggleRawMode) io.stdin.setRawMode(false);
		const result = spawnSync(shell, ["-c", commandBody], { stdio: "inherit" });
		if (canToggleRawMode) io.stdin.setRawMode(true);
		r.resume();
		if (result.error) io.stderr.write(`dsh: ${result.error.message}\n`);
		else if (typeof result.status === "number" && result.status !== 0) {
			io.stderr.write(`dsh: shell command exited with status ${result.status}\n`);
		}
	}

	async function runMagicCommand({ name: commandName, args }) {
		switch (commandName) {
			case "help":
				io.stdout.write(helpText());
				break;
			case "history": {
				const requested = Number.parseInt(args, 10);
				const count = Number.isInteger(requested) && requested > 0 ? requested : 20;
				for (const entry of r.history.slice(0, count).reverse()) io.stdout.write(`${entry}\n`);
				break;
			}
			case "clear":
				io.stdout.write("\x1b[2J\x1b[3J\x1b[H");
				break;
			case "save":
				if (args === "") {
					io.stderr.write("dsh: /save requires a path, e.g. /save transcript.log\n");
				} else {
					try {
						copyFileSync(transcriptPath, args);
						io.stdout.write(`saved transcript to ${args}\n`);
					} catch (error) {
						io.stderr.write(`dsh: /save failed: ${error instanceof Error ? error.message : String(error)}\n`);
					}
				}
				break;
			case "reload":
				agent = await createAgent();
				transcriptPath = transcriptFilePath(agent.session.id, dshHome);
				mkdirSync(dirname(transcriptPath), { recursive: true });
				turnNumber = 1;
				io.stdout.write("started a fresh session\n");
				break;
			case "exit":
			case "quit":
				r.close();
				break;
			case "unknown":
				io.stderr.write(`dsh: unknown command "/${args}" (try /help)\n`);
				break;
		}
		shellPromptActive = false;
		r.setPrompt(promptText());
	}

	async function runTurn(text) {
		streamed = false;
		thinking = false;
		const firstSeq = agent.session.seq;
		appendTranscript(`> ${text}`);
		agent.followup(createUserMessage({ content: [{ type: "text", text }], source: { kind: "user" } }));
		await agent.whenIdle();
		await sessions.flush(agent.session);
		const outcome = summarizeTurn(agent.session.events, firstSeq);
		if (streamed) io.stdout.write("\n");
		else if (outcome.text !== "") io.stdout.write(`${outcome.text}\n`);
		if (outcome.text !== "") appendTranscript(`< ${outcome.text}`);
		if (outcome.reason?.kind === "error") {
			io.stderr.write(`dsh: ${outcome.reason.error.code}: ${outcome.reason.error.message}\n`);
		}
		turnNumber++;
		shellPromptActive = false;
		r.setPrompt(promptText());
	}

	async function evaluate(cmd, context, filename, callback) {
		const rawLine = cmd.replace(/[\r\n]+$/, "");

		if (isShellEscape(rawLine)) {
			await enqueue(() => runShellCommand(shellCommandBody(rawLine)));
			return callback(null);
		}

		const trimmed = rawLine.trim();
		const magic = /^(exit|quit)$/i.test(trimmed) ? { name: trimmed.toLowerCase(), args: "" } : parseMagicCommand(rawLine);
		if (magic !== null) {
			await enqueue(() => runMagicCommand(magic));
			return callback(null);
		}

		if (needsContinuation(cmd)) {
			return callback(new repl.Recoverable(new Error("incomplete input")));
		}

		if (trimmed !== "") await enqueue(() => runTurn(trimmed));
		callback(null);
	}

	const completer = (line, callback) => {
		computeCompletions({
			line,
			commandNames: MAGIC_COMMANDS.map((command) => command.name),
			history: r.history,
			cwd: process.cwd(),
		})
			.then((result) => callback(null, result))
			.catch((error) => callback(error));
	};

	io.stdout.write(
		`dsh repl — ${defaultModel.currentSelection().provider}/${defaultModel.currentSelection().model}. Ctrl-D, "exit", or /quit to quit. /help for more.\n`,
	);

	let r = repl.start({
		prompt: promptText(),
		input: io.stdin,
		output: io.stdout,
		eval: evaluate,
		completer,
		ignoreUndefined: true,
	});

	r.setupHistory({ filePath: historyFilePath(dshHome), size: 1000, removeHistoryDuplicates: true }, (error) => {
		if (error) io.stderr.write(`dsh: couldn't load persistent history: ${error.message}\n`);
	});

	// Redraws the "[n]>" prompt at a fixed width so cursor bookkeeping never
	// desyncs. See docs/dsh-repl-runner-internals.md.
	function repaintPrompt(color, includeBang) {
		if (!useColor) return;
		const bang = includeBang ? colorize(color, "!") : "";
		io.stdout.write(`\x1b[s\r${promptText(color)}${bang}\x1b[u`);
	}

	function clearLine() {
		r.write(null, { ctrl: true, name: "e" });
		r.write(null, { ctrl: true, name: "u" });
	}

	if (io.stdin.isTTY) {
		// Pre-keystroke snapshot of r.line — see docs/dsh-repl-runner-internals.md.
		let previousLine = "";

		io.stdin.on("keypress", (_str, key) => {
			const priorLine = previousLine;
			const isEnter = _str === "\r" || _str === "\n" || key?.name === "return" || key?.name === "enter";

			if (isEnter) {
				previousLine = "";
				return;
			}

			if (key?.name === "escape" && r.line.startsWith("!")) {
				try {
					clearLine();
				} catch {
					// the interface may already be closing; nothing to clear
				}
				shellPromptActive = false;
				repaintPrompt("36", false);
				previousLine = "";
				return;
			}

			// The "! " prefix is protected from every edit but Esc — see docs/dsh-repl-runner-internals.md.
			if (priorLine.startsWith("! ") && !r.line.startsWith("! ")) {
				try {
					clearLine();
					if (priorLine !== "") r.write(priorLine);
				} catch {
					// the interface may already be closing; nothing to restore
				}
				previousLine = priorLine;
				repaintPrompt(FUCHSIA, true);
				return;
			}

			// Typing the leading "!" auto-inserts the separating space, so
			// the shell command always starts clear of the bang.
			if (priorLine === "" && r.line === "!") r.write(" ");

			// Repainted every keystroke, not just on transition — see docs/dsh-repl-runner-internals.md.
			const isShellLine = r.line.startsWith("!");
			shellPromptActive = isShellLine;
			repaintPrompt(isShellLine ? FUCHSIA : "36", isShellLine);

			previousLine = r.line;
		});
	}

	r.on("exit", async () => {
		await queue;
		await sessions.flush(agent.session);
		io.exit(0);
	});
}

function apply(ctx, config) {
	const exit = ctx.get("appExit");
	if (exit === void 0) throw new Error("repl-runner: the launcher must provide ctx.appExit before the tree mounts");
	const io = {
		stdin: internals.stdin,
		stdout: internals.stdout,
		stderr: internals.stderr,
		exit,
	};
	runRepl(ctx, io).catch((error) => {
		io.stderr.write(`dsh: ${error instanceof Error ? error.message : String(error)}\n`);
		io.exit(1);
	});
}

export { Config, apply, inject, internals, name };
