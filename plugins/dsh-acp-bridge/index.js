import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import z from "@deepseek-ai/schemastery";
import * as acp from "@agentclientprotocol/sdk";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { buildInitializeResponse } from "./initialize.js";
import { promptText } from "./prompt-text.js";
import { toSessionUpdate } from "./session-updates.js";
import { stopReasonFor } from "./stop-reason.js";

/**
 * dsh-acp-bridge — implements the agent side of the official Agent Client
 * Protocol (agentclientprotocol.com) over stdio, driving the dsh Agent
 * in-process. Permissions, plan updates, session load/list, presets, and MCP
 * passthrough land in task-002.03.
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

	// Keyed by dsh Session id, which we reuse directly as the ACP sessionId —
	// one id space, no separate mapping to keep in sync.
	const bridgeSessions = new Map();

	async function createDshAgent(cwd) {
		const selection = defaultModel.currentSelection();
		const { agent } = await agents.create({
			sessionId: SessionId(`session-${randomUUID()}`),
			meta: { cwd },
			agentOptions: { provider: selection.provider, model: selection.model },
			setup: (agentCtx) => {
				installModelSelection(agentCtx, { current: selection, assembled: void 0 });
			},
		});
		await agent.whenIdle();
		return agent;
	}

	// stdout carries only JSON-RPC frames past this point — never write
	// diagnostics there; io.stderr is for that.
	const stream = acp.ndJsonStream(Writable.toWeb(io.stdout), Readable.toWeb(io.stdin));
	const connection = acp
		.agent({ name: "dsh-acp-bridge" })
		.onRequest("initialize", () => buildInitializeResponse())
		.onRequest("session/new", async (context) => {
			const agent = await createDshAgent(context.params.cwd);
			bridgeSessions.set(agent.session.id, agent);
			return { sessionId: agent.session.id };
		})
		.onRequest("session/prompt", async (context) => {
			const agent = bridgeSessions.get(context.params.sessionId);
			if (agent === void 0) throw new Error(`dsh-acp-bridge: unknown session ${context.params.sessionId}`);

			const firstSeq = agent.session.seq;
			agent.followup(
				createUserMessage({ content: [{ type: "text", text: promptText(context.params.prompt) }], source: { kind: "user" } }),
			);
			await agent.whenIdle();
			await sessions.flush(agent.session);

			let reason;
			for (const event of agent.session.events) {
				if (event.seq >= firstSeq && event.type === "turn/end") reason = event.data.reason;
			}
			return { stopReason: stopReasonFor(reason) };
		})
		.connect(stream);

	ctx.on("session/event", (session, event) => {
		if (!bridgeSessions.has(session.id)) return;
		const update = toSessionUpdate(event);
		if (update !== null) connection.client.notify("session/update", { sessionId: session.id, update });
	});

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
