import { randomUUID } from "node:crypto";
import readline from "node:readline";
import z from "@deepseek-ai/schemastery";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { summarizeTurn } from "./summarize-turn.js";

/**
 * dsh-repl-runner — an interactive, multi-turn direct Agent driver.
 *
 * Same primitives as @deepseek-ai/dsh-headless (one Agent created through the
 * core registry, driven with followup/whenIdle), but the Agent/Session stay
 * alive across a stdin readline loop instead of exiting after one task.
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

	const selection = defaultModel.currentSelection();
	const { agent } = await agents.create({
		sessionId: SessionId(`session-${randomUUID()}`),
		meta: { cwd: process.cwd() },
		agentOptions: {
			provider: selection.provider,
			model: selection.model,
		},
		setup: (agentCtx) => {
			installModelSelection(agentCtx, {
				current: selection,
				assembled: void 0,
			});
		},
	});
	await agent.whenIdle();

	io.stdout.write(`dsh repl — ${selection.provider}/${selection.model}. Ctrl-D or "exit" to quit.\n`);
	const rl = readline.createInterface({ input: io.stdin, output: io.stdout, prompt: "> " });
	rl.prompt();

	// All line handling funnels through this single chain. Piped stdin can
	// deliver several complete lines in one chunk; readline emits a "line"
	// event for each of them synchronously, in the same tick, before an
	// rl.pause() called from within a handler has any chance to take effect
	// (the remaining lines were already split out of the chunk). Serializing
	// via .then() on a shared promise — rather than pause()/resume() — is
	// what actually guarantees one turn finishes before the next starts.
	let queue = Promise.resolve();
	let closing = false;

	rl.on("line", (line) => {
		const text = line.trim();
		if (text === "") {
			if (!closing) rl.prompt();
			return;
		}
		if (text === "exit" || text === "quit") {
			closing = true;
			queue = queue.then(() => rl.close());
			return;
		}
		queue = queue
			.then(async () => {
				const firstSeq = agent.session.seq;
				agent.followup(
					createUserMessage({
						content: [{ type: "text", text }],
						source: { kind: "user" },
					}),
				);
				await agent.whenIdle();
				await sessions.flush(agent.session);
				const outcome = summarizeTurn(agent.session.events, firstSeq);
				if (outcome.text !== "") io.stdout.write(outcome.text + "\n");
				if (outcome.reason?.kind === "error") {
					io.stderr.write(`dsh: ${outcome.reason.error.code}: ${outcome.reason.error.message}\n`);
				}
			})
			.catch((error) => {
				io.stderr.write(`dsh: ${error instanceof Error ? error.message : String(error)}\n`);
			})
			.finally(() => {
				if (!closing) rl.prompt();
			});
	});

	rl.on("close", async () => {
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
