/**
 * Translate one dsh Session event into an ACP `session/update` payload
 * (the `update` field of a `SessionNotification`), or null if the event
 * type has no ACP equivalent to stream.
 *
 * `view` is the tool's own presenter render intent for a `tool/call` event
 * (`ctx.tools.get(name, scope)?.presentCall?.(args)`, mirroring
 * dsh-host-apiproxy's `viewFor`) — undefined when there is no tool registry,
 * no matching tool, or the tool defines no `presentCall`. It is ignored for
 * every other event type.
 *
 * @param {{type: string, data: any}} event
 * @param {object} [view]
 * @returns {object | null}
 */
export function toSessionUpdate(event, view) {
	switch (event.type) {
		case "assistant/chunk":
			return assistantChunkUpdate(event);
		case "tool/call":
			return toolCallStartUpdate(event, view);
		case "tool/result":
			return toolCallResultUpdate(event);
		case "todo/write":
			return planUpdate(event);
		default:
			return null;
	}
}

/**
 * Map a presenter's render-intent card to an ACP `ToolKind`. Mirrors the
 * card/kind vocabulary the shipped tool plugins actually return from
 * `presentCall`/`presentResult` (see dsh-tool-str-replace-editor, dsh-tool-fs,
 * dsh-tool-bash, dsh-tool-fs-search, dsh-tool-web); an absent or unrecognized
 * view soft-falls to "other", matching the pre-existing hardcoded default.
 *
 * @param {object} [view]
 * @returns {string}
 */
export function kindFromView(view) {
	switch (view?.card) {
		case "diff":
			return "edit";
		case "terminal":
			return "execute";
		case "read":
			return "read";
		case "search":
			return "search";
		case "generic":
		case "web":
			return view.kind === "search" || view.kind === "fetch" || view.kind === "execute" || view.kind === "read" ? view.kind : "other";
		default:
			return "other";
	}
}

/**
 * Build ACP diff content blocks from a "diff"-card presenter view.
 *
 * @param {{diffs: {path: string, oldText: string | null, newText: string}[]}} view
 * @returns {object[]}
 */
export function diffContent(view) {
	return view.diffs.map((diff) => ({ type: "diff", path: diff.path, oldText: diff.oldText, newText: diff.newText }));
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

function toolCallStartUpdate(event, view) {
	const { callId, name, arguments: rawInput } = event.data;
	return {
		sessionUpdate: "tool_call",
		toolCallId: callId,
		title: name,
		kind: kindFromView(view),
		status: "in_progress",
		rawInput,
		...view?.card === "diff" ? { content: diffContent(view) } : {},
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

function planUpdate(event) {
	return {
		sessionUpdate: "plan",
		entries: event.data.todos.map((todo) => ({ content: todo.content, priority: "medium", status: todo.status })),
	};
}
