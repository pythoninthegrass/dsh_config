import * as acp from "@agentclientprotocol/sdk";

/**
 * The ACP `initialize` response this bridge advertises. Session creation,
 * prompting, permissions, and session compat land in later phases — see
 * backlog task-002.02/task-002.03.
 */
export function buildInitializeResponse() {
	return {
		protocolVersion: acp.PROTOCOL_VERSION,
		agentCapabilities: { loadSession: false },
	};
}
