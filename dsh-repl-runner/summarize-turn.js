/**
 * Extract one turn's result from a Session's durable event log.
 *
 * Mirrors @deepseek-ai/dsh-headless's own `summarize`: only events at or
 * after `firstSeq` count, only events after the turn's `turn/start` count,
 * and the LAST non-empty assistant/message text wins (an intermediate
 * assistant message ahead of a tool call is not the turn's answer).
 *
 * @param {Array<{seq: number, type: string, data?: any}>} events
 * @param {number} firstSeq
 * @returns {{text: string, reason: any}}
 */
export function summarizeTurn(events, firstSeq) {
	let started = false;
	let text = "";
	let reason;
	for (const event of events) {
		if (event.seq < firstSeq) continue;
		if (event.type === "turn/start") {
			started = true;
			continue;
		}
		if (!started) continue;
		if (event.type === "assistant/message") {
			const joined = event.data.message.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("");
			if (joined !== "") text = joined;
		}
		if (event.type === "turn/end") reason = event.data.reason;
	}
	return { text, reason };
}
