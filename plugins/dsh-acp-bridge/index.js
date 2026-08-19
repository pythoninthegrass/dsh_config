import { Readable, Writable } from "node:stream";
import z from "@deepseek-ai/schemastery";
import * as acp from "@agentclientprotocol/sdk";
import { buildInitializeResponse } from "./initialize.js";

/**
 * dsh-acp-bridge — implements the agent side of the official Agent Client
 * Protocol (agentclientprotocol.com) over stdio, driving the dsh Agent
 * in-process. `session/new` and `session/prompt` land in task-002.02; this
 * phase only answers `initialize`.
 */

const name = "dsh-acp-bridge";
const inject = ["agentDefaultModel", "agents", "sessions"];
const Config = z.object({
	// Pins the credential gate so session creation doesn't fall back to
	// deepseek-official and hit auth_required — see profiles/tui/cordis.patch.yml.
	provider: z.string().default("local"),
});

const internals = {
	stdin: process.stdin,
	stdout: process.stdout,
	stderr: process.stderr,
};

async function runBridge(ctx, io) {
	await ctx.get("loader")?.await();
	const agents = ctx.get("agents");
	const defaultModel = ctx.get("agentDefaultModel");
	const sessions = ctx.get("sessions");
	if (agents === void 0 || defaultModel === void 0 || sessions === void 0) return;

	// stdout carries only JSON-RPC frames past this point — never write
	// diagnostics there; io.stderr is for that.
	const stream = acp.ndJsonStream(Writable.toWeb(io.stdout), Readable.toWeb(io.stdin));
	const connection = acp
		.agent({ name: "dsh-acp-bridge" })
		.onRequest("initialize", () => buildInitializeResponse())
		.connect(stream);

	await connection.closed;
	io.exit(0);
}

function apply(ctx, config) {
	const exit = ctx.get("appExit");
	if (exit === void 0) throw new Error("dsh-acp-bridge: the launcher must provide ctx.appExit before the tree mounts");
	const io = { stdin: internals.stdin, stdout: internals.stdout, stderr: internals.stderr, exit };
	runBridge(ctx, io).catch((error) => {
		io.stderr.write(`dsh-acp-bridge: ${error instanceof Error ? error.message : String(error)}\n`);
		io.exit(1);
	});
}

export { Config, apply, inject, internals, name };
