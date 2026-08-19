/**
 * Flatten an ACP `session/prompt` request's content blocks into plain text
 * for the dsh Agent, which only accepts a text user message today.
 *
 * @param {Array<{type: string, text?: string}>} blocks
 * @returns {string}
 */
export function promptText(blocks) {
	return blocks
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("");
}
