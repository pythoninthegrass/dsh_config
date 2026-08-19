import * as acp from "@agentclientprotocol/sdk";

/**
 * The ACP `initialize` response this bridge advertises. `session/resume` and
 * `session/delete` stay unadvertised — only `session/load` and `session/list`
 * are implemented.
 */
export function buildInitializeResponse() {
	return {
		protocolVersion: acp.PROTOCOL_VERSION,
		agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } },
	};
}
