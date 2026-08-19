/**
 * Translate one dsh Session event into an ACP `session/update` payload
 * (the `update` field of a `SessionNotification`), or null if the event
 * type has no ACP equivalent to stream.
 *
 * @param {{type: string, data: any}} event
 * @returns {object | null}
 */
export function toSessionUpdate(event) {
	switch (event.type) {
		case "assistant/chunk":
			return assistantChunkUpdate(event);
		case "tool/call":
			return toolCallStartUpdate(event);
		case "tool/result":
			return toolCallResultUpdate(event);
		default:
			return null;
	}
}

function assistantChunkUpdate(event) {
	const { chunk } = event.data;
	if (chunk.type === "text-delta") {
		return { sessionUpdate: "agent_message_chunk", content: { type: "text", text: chunk.text } };
	}
	if (chunk.type === "reasoning-delta") {
		return { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: chunk.text } };
	}
	return null;
}

function toolCallStartUpdate(event) {
	const { callId, name, arguments: rawInput } = event.data;
	return {
		sessionUpdate: "tool_call",
		toolCallId: callId,
		title: name,
		kind: "other",
		status: "in_progress",
		rawInput,
	};
}

function toolCallResultUpdate(event) {
	const block = event.data.message.content.find((entry) => entry.type === "tool-result");
	if (block === undefined) return null;
	return {
		sessionUpdate: "tool_call_update",
		toolCallId: block.toolCallId,
		status: block.isError ? "failed" : "completed",
		content: toolCallContent(block.content),
	};
}

function toolCallContent(blocks) {
	return blocks.filter((block) => block.type === "text").map((block) => ({ type: "content", content: { type: "text", text: block.text } }));
}
