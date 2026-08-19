import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import z from "@deepseek-ai/schemastery";
import * as acp from "@agentclientprotocol/sdk";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { toAvailableCommands } from "./available-commands.js";
import { commandResultUpdate } from "./command-result.js";
import { buildInitializeResponse } from "./initialize.js";
import { outcomeToApproval, toPermissionRequest } from "./permission.js";
import { promptText } from "./prompt-text.js";
import { toSessionInfo } from "./session-info.js";
import { toSessionModeState } from "./session-modes.js";
import { toSessionUpdate } from "./session-updates.js";
import { stopReasonFor } from "./stop-reason.js";
import { backscanToolCall, resolveCallView } from "./tool-view.js";

/**
 * dsh-acp-bridge — implements the agent side of the official Agent Client
 * Protocol (agentclientprotocol.com) over stdio, driving the dsh Agent
 * in-process.
 */

const name = "dsh-acp-bridge";
const inject = ["agentDefaultModel", "agentPresets", "agents", "approval", "commands", "sessionPersistence", "sessions", "tools"];
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
	const agentPresets = ctx.get("agentPresets");
	const approval = ctx.get("approval");
	const commands = ctx.get("commands");
	const defaultModel = ctx.get("agentDefaultModel");
	const sessionPersistence = ctx.get("sessionPersistence");
	const sessions = ctx.get("sessions");
	const tools = ctx.get("tools");
	if (
		agents === void 0 ||
		agentPresets === void 0 ||
		approval === void 0 ||
		commands === void 0 ||
		defaultModel === void 0 ||
		sessionPersistence === void 0 ||
		sessions === void 0 ||
		tools === void 0
	)
		return;

	// Keyed by dsh Session id, which we reuse directly as the ACP sessionId —
	// one id space, no separate mapping to keep in sync.
	const bridgeSessions = new Map();

	// Mounts a preset (default when `presetId` is undefined) onto a freshly
	// created or resumed agent's scope. Shared by session/new, session/load,
	// and session/set_mode's teardown-and-recreate.
	function installAgent(agentCtx, selection, presetId) {
		installModelSelection(agentCtx, { current: selection, assembled: void 0 });
		return agentPresets.mount(agentCtx, presetId);
	}

	async function createDshAgent(sessionId, cwd, presetId) {
		const selection = defaultModel.currentSelection();
		let mountedPreset;
		const handle = await agents.create({
			sessionId,
			meta: { cwd },
			agentOptions: { provider: selection.provider, model: selection.model },
			setup: async (agentCtx) => {
				mountedPreset = await installAgent(agentCtx, selection, presetId);
			},
		});
		await handle.agent.whenIdle();
		return { agent: handle.agent, dispose: handle.dispose, presetId: mountedPreset.id };
	}

	async function resumeDshAgent(resumeSessionId) {
		const headers = await sessionPersistence.list();
		const header = headers.find((candidate) => candidate.id === resumeSessionId);
		const selection = defaultModel.currentSelection();
		let mountedPreset;
		const handle = await agents.resume({
			resumeSessionId,
			agentOptions: { provider: selection.provider, model: selection.model },
			setup: async (agentCtx) => {
				mountedPreset = await installAgent(agentCtx, selection, header?.agentPreset);
			},
		});
		await handle.agent.whenIdle();
		return { agent: handle.agent, dispose: handle.dispose, presetId: mountedPreset.id, cwd: header?.cwd };
	}

	// stdout carries only JSON-RPC frames past this point — never write
	// diagnostics there; io.stderr is for that.
	const stream = acp.ndJsonStream(Writable.toWeb(io.stdout), Readable.toWeb(io.stdin));
	const connection = acp
		.agent({ name: "dsh-acp-bridge" })
		.onRequest("initialize", () => buildInitializeResponse())
		.onRequest("session/new", async (context) => {
			const sessionId = SessionId(`session-${randomUUID()}`);
			const { agent, dispose, presetId } = await createDshAgent(sessionId, context.params.cwd, void 0);
			bridgeSessions.set(agent.session.id, { agent, dispose, presetId, cwd: context.params.cwd });

			await context.client.notify("session/update", {
				sessionId: agent.session.id,
				update: { sessionUpdate: "available_commands_update", availableCommands: toAvailableCommands(commands.list(agent)) },
			});

			const presets = await agentPresets.list();
			return { sessionId: agent.session.id, modes: toSessionModeState(presets, presetId) };
		})
		.onRequest("session/load", async (context) => {
			const { agent, dispose, presetId, cwd } = await resumeDshAgent(context.params.sessionId);
			bridgeSessions.set(agent.session.id, { agent, dispose, presetId, cwd: cwd ?? context.params.cwd });

			for (const event of agent.session.events) {
				const view = event.type === "tool/call" ? resolveCallView(tools, agent, event.data.name, event.data.arguments) : void 0;
				const update = toSessionUpdate(event, view);
				if (update !== null) await context.client.notify("session/update", { sessionId: agent.session.id, update });
			}

			const presets = await agentPresets.list();
			return { modes: toSessionModeState(presets, presetId) };
		})
		.onRequest("session/list", async (context) => {
			const headers = await sessionPersistence.list(context.signal);
			const cwd = context.params.cwd ?? void 0;
			const filtered = cwd === void 0 ? headers : headers.filter((header) => header.cwd === cwd);
			return { sessions: filtered.map(toSessionInfo) };
		})
		.onRequest("session/set_mode", async (context) => {
			const entry = bridgeSessions.get(context.params.sessionId);
			if (entry === void 0) throw new Error(`dsh-acp-bridge: unknown session ${context.params.sessionId}`);

			await entry.dispose();
			const { agent, dispose, presetId } = await createDshAgent(context.params.sessionId, entry.cwd, context.params.modeId);
			bridgeSessions.set(agent.session.id, { agent, dispose, presetId, cwd: entry.cwd });
			return {};
		})
		.onRequest("session/prompt", async (context) => {
			const entry = bridgeSessions.get(context.params.sessionId);
			if (entry === void 0) throw new Error(`dsh-acp-bridge: unknown session ${context.params.sessionId}`);
			const { agent } = entry;

			const text = promptText(context.params.prompt);
			const execution = await commands.execute(agent, text, context.signal);
			if (execution !== void 0) {
				const update = commandResultUpdate(execution.result);
				if (update !== null) await context.client.notify("session/update", { sessionId: agent.session.id, update });
				return { stopReason: "end_turn" };
			}

			const firstSeq = agent.session.seq;
			agent.followup(createUserMessage({ content: [{ type: "text", text }], source: { kind: "user" } }));
			await agent.whenIdle();
			await sessions.flush(agent.session);

			let reason;
			for (const event of agent.session.events) {
				if (event.seq >= firstSeq && event.type === "turn/end") reason = event.data.reason;
			}
			return { stopReason: stopReasonFor(reason) };
		})
		.connect(stream);

	ctx.on("approval/request", async (req, next) => {
		let sessionId;
		for (const [id, entry] of bridgeSessions) {
			if (entry.agent === req.agent) {
				sessionId = id;
				break;
			}
		}
		if (sessionId === void 0) return next();

		const call = req.callId === void 0 ? void 0 : backscanToolCall(req.agent.session.events, req.callId);
		const view = call === void 0 ? void 0 : resolveCallView(tools, req.agent, call.name, call.arguments);
		const request = toPermissionRequest(sessionId, req, view);
		const response = await connection.client.request(acp.methods.client.session.requestPermission, request);
		return outcomeToApproval(response.outcome);
	});

	ctx.on("session/event", (session, event) => {
		const entry = bridgeSessions.get(session.id);
		if (entry === void 0) return;
		const view = event.type === "tool/call" ? resolveCallView(tools, entry.agent, event.data.name, event.data.arguments) : void 0;
		const update = toSessionUpdate(event, view);
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
