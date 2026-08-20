/**
 * evidence-guard.js — pure decision logic for the dsh-honesty-gate plugin's
 * `tools/pre-execute` hook (AD-009.34 follow-up, targets azure-dreams-remake).
 *
 * AD-009.34: an autonomous run hand-wrote a `tools/census/state_overlay.toml`
 * `evidence` string narrating a local-model builder run that never happened.
 * azure-dreams-remake's `tools/gen_evidence.py` now re-runs the real gate and
 * refuses to print evidence text it can't back up, and persists a receipt
 * (`.tools/gen_evidence/receipts/<addr>.json`) recording exactly what it just
 * substantiated. This module is the harness-level half: it denies a proposed
 * file-write tool call before it dispatches if either
 *
 *   1. it targets `.tools/gen_evidence/receipts/` directly — that directory
 *      must only ever be populated by gen_evidence.py itself, or an agent
 *      could just hand-forge the receipt gen_evidence.py is supposed to
 *      certify; or
 *   2. it targets `tools/census/state_overlay.toml` and contains a
 *      `[[func]]` block whose `state` is translated/verified/sdk-mapped
 *      without a matching, fresh, exact-text receipt for that addr.
 *
 * Deliberately narrow: this catches the exact AD-009.34 shape (a structured
 * write tool touching those two paths), not arbitrary `bash` heredoc writes
 * or edits to other files a narrative could hide in. It's a mechanical
 * backstop on top of the AGENTS.md rule, not a substitute for it.
 *
 * index.js wires this to real fs/process.cwd(); everything here is pure —
 * it takes its receipt lookup and clock as arguments — so it's testable
 * without touching disk.
 */

const OVERLAY_PATH_SUFFIX = "tools/census/state_overlay.toml";
const RECEIPTS_DIR_MARKER = ".tools/gen_evidence/receipts/";
const EVIDENCE_STATES = new Set(["translated", "verified", "sdk-mapped"]);
const FRESHNESS_MS = 6 * 60 * 60 * 1000;

// Mirrors tools/gen_evidence.py's assemble_block() output exactly -- that's
// the only producer of this shape, so the pattern can stay simple.
const FUNC_BLOCK_RE =
	/\[\[func\]\]\s*addr\s*=\s*"([^"]*)"\s*name\s*=\s*"([^"]*)"\s*state\s*=\s*"([^"]*)"\s*evidence\s*=\s*"([^"]*)"/g;

/** Recursively gathers every string value out of a JSON-serializable tool-call
 * arguments object, regardless of which field name a given tool uses for
 * "path" vs. "content" vs. "new_string" -- avoids guessing a specific tool's
 * argument shape. */
export function collectStrings(value, out = []) {
	if (typeof value === "string") {
		out.push(value);
	} else if (Array.isArray(value)) {
		for (const item of value) collectStrings(item, out);
	} else if (value !== null && typeof value === "object") {
		for (const item of Object.values(value)) collectStrings(item, out);
	}
	return out;
}

export function targetsPath(strings, suffix) {
	return strings.some((s) => s === suffix || s.endsWith(`/${suffix}`));
}

export function targetsReceiptsDir(strings) {
	return strings.some((s) => s.includes(RECEIPTS_DIR_MARKER));
}

export function extractFuncBlocks(strings) {
	const blocks = [];
	for (const s of strings) {
		for (const m of s.matchAll(FUNC_BLOCK_RE)) {
			blocks.push({ addr: m[1], name: m[2], state: m[3], evidence: m[4] });
		}
	}
	return blocks;
}

/** Mirrors tools/gen_evidence.py's receipt_path(): lowercase, strip "0x". */
export function receiptFileName(addr) {
	return `${addr.toLowerCase().replace(/^0x/, "")}.json`;
}

/**
 * @param {object} input
 * @param {string[]} input.strings - every string value from the proposed
 *   tool call's arguments (see collectStrings).
 * @param {(fileName: string) => ({evidence: string, state: string, generated_at: number} | null)} input.readReceipt
 * @param {() => number} [input.now] - ms clock, injectable for tests.
 * @returns {{kind: 'allow'} | {kind: 'deny', reason: string}}
 */
export function evaluateWrite({ strings, readReceipt, now = Date.now }) {
	if (targetsReceiptsDir(strings)) {
		return {
			kind: "deny",
			reason:
				"dsh-honesty-gate: writes under .tools/gen_evidence/receipts/ are not allowed -- that " +
				"directory is populated only by tools/gen_evidence.py itself (AD-009.34 follow-up); " +
				"hand-writing a receipt would defeat the check it exists for.",
		};
	}

	if (!targetsPath(strings, OVERLAY_PATH_SUFFIX)) {
		return { kind: "allow" };
	}

	for (const block of extractFuncBlocks(strings)) {
		if (!EVIDENCE_STATES.has(block.state)) continue;

		const receipt = readReceipt(receiptFileName(block.addr));
		if (!receipt) {
			return {
				kind: "deny",
				reason:
					`dsh-honesty-gate: no tools/gen_evidence.py receipt found for ${block.addr} ` +
					`(state "${block.state}") -- run \`task c-lang:gen-evidence\` for real and paste ` +
					"its exact output instead of hand-writing this evidence string (AD-009.34).",
			};
		}
		if (receipt.state !== block.state || receipt.evidence !== block.evidence) {
			return {
				kind: "deny",
				reason:
					`dsh-honesty-gate: the state/evidence text for ${block.addr} does not match what ` +
					"tools/gen_evidence.py actually generated and receipted -- re-run " +
					"`task c-lang:gen-evidence` and paste its output verbatim, don't hand-edit it.",
			};
		}
		const ageMs = now() - receipt.generated_at * 1000;
		if (!(ageMs >= 0) || ageMs > FRESHNESS_MS) {
			return {
				kind: "deny",
				reason:
					`dsh-honesty-gate: the receipt for ${block.addr} is stale or has a bad timestamp -- ` +
					"re-run `task c-lang:gen-evidence` right before writing this block.",
			};
		}
	}

	return { kind: "allow" };
}
