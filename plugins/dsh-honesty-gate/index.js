import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectStrings, evaluateWrite } from "./evidence-guard.js";

/**
 * dsh-honesty-gate — harness-level backstop for AD-009.34-style evidence
 * fabrication in azure-dreams-remake. See evidence-guard.js for the actual
 * decision logic; this file only wires it to a real `tools/pre-execute`
 * hook, real fs, and process.cwd().
 *
 * ToolExecutionInput has no cwd/project-root field, so this follows the
 * same convention as the profile's MCP servers (`backlog mcp start`,
 * `serena --project-from-cwd`): resolve the target repo from process.cwd()
 * at hook-fire time, not from anything on the execution object.
 *
 * Deny-only by construction: on any error reading a receipt file, treat it
 * as absent (deny), never as implicitly satisfied.
 */

export const name = "dsh-honesty-gate";
export const inject = ["tools"];

function readReceipt(cwd, fileName) {
	try {
		const raw = readFileSync(join(cwd, ".tools", "gen_evidence", "receipts", fileName), "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function apply(ctx) {
	ctx.on("tools/pre-execute", async (exec, next) => {
		const decision = evaluateWrite({
			strings: collectStrings(exec.arguments),
			readReceipt: (fileName) => readReceipt(process.cwd(), fileName),
		});
		if (decision.kind === "deny") return decision;
		return next();
	});
}
