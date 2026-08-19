/**
 * Resolve a tool's presenter render-intent for a `tool/call` event, mirroring
 * dsh-host-apiproxy's `viewFor`. Soft-falls to undefined on any failure — no
 * tool registry, no matching tool, no `presentCall`, or a JSON.parse throw —
 * so a presenter bug never breaks the bridge.
 *
 * @param {{get(name: string, scope: any): {presentCall?: (args: any) => any} | undefined} | undefined} tools
 * @param {any} scope - the viewing scope (the dsh agent), passed straight to `tools.get`.
 * @param {string} name
 * @param {string} rawArgs - the tool/call event's JSON-encoded arguments.
 * @returns {object | undefined}
 */
export function resolveCallView(tools, scope, name, rawArgs) {
	if (tools === void 0) return void 0;
	try {
		return tools.get(name, scope)?.presentCall?.(JSON.parse(rawArgs));
	} catch {
		return void 0;
	}
}

/**
 * Find the `tool/call` event that started a given callId, scanning backwards
 * from the end of a session's event log. `appendToolCall` commits this event
 * before the approval gate runs, so a pending `approval/request` can always
 * find its call this way — the request itself carries no `arguments`.
 *
 * @param {{type: string, data: any}[]} events
 * @param {string} callId
 * @returns {{callId: string, name: string, arguments: string} | undefined}
 */
export function backscanToolCall(events, callId) {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (event.type === "tool/call" && event.data.callId === callId) return event.data;
	}
	return void 0;
}
