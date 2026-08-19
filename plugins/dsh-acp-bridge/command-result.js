/**
 * Map a dsh `CommandResult` (from `CommandRuntime.execute`) to an ACP
 * `session/update` payload carrying the command's rendered text, or null
 * when there's nothing to show.
 *
 * @param {{kind: "success"|"error", text?: string}} result
 * @returns {object | null}
 */
export function commandResultUpdate(result) {
	if (result.text === undefined) return null;
	return { sessionUpdate: "agent_message_chunk", content: { type: "text", text: result.text } };
}
