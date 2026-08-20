import { test } from "node:test";
import assert from "node:assert/strict";
import { collectStrings, extractFuncBlocks, receiptFileName, evaluateWrite } from "./evidence-guard.js";

function overlayBlock({ addr = "0x800A6D30", name = "ad_rand_secondary", state = "verified", evidence = "e" }) {
	return `[[func]]\naddr = "${addr}"\nname = "${name}"\nstate = "${state}"\nevidence = "${evidence}"\n`;
}

function writeArgs(path, content) {
	return { file_path: path, new_string: content };
}

test("collectStrings gathers nested string values", () => {
	const strings = collectStrings({ a: "x", b: { c: "y", d: ["z", 1, null] } });
	assert.deepEqual(strings.sort(), ["x", "y", "z"]);
});

test("extractFuncBlocks parses gen_evidence.py's exact block shape", () => {
	const blocks = extractFuncBlocks([overlayBlock({ evidence: "verified just now: 4 directed + 256 random" })]);
	assert.deepEqual(blocks, [
		{ addr: "0x800A6D30", name: "ad_rand_secondary", state: "verified", evidence: "verified just now: 4 directed + 256 random" },
	]);
});

test("receiptFileName lowercases and strips 0x prefix", () => {
	assert.equal(receiptFileName("0x800A6D30"), "800a6d30.json");
});

test("allows unrelated tool calls untouched", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census.py", "print('hi')")),
		readReceipt: () => null,
	});
	assert.deepEqual(decision, { kind: "allow" });
});

test("denies any write that targets the receipts directory itself", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs(".tools/gen_evidence/receipts/800a6d30.json", '{"ok": true}')),
		readReceipt: () => null,
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /receipts\/ are not allowed/);
});

test("denies an overlay write with an evidence-bearing state and no receipt", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "verified" }))),
		readReceipt: () => null,
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /no tools\/gen_evidence\.py receipt found/);
});

test("allows a decoded-state block with no receipt (decoded needs no gate)", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "decoded" }))),
		readReceipt: () => null,
	});
	assert.deepEqual(decision, { kind: "allow" });
});

test("denies when the receipt's evidence text doesn't match what's being written", () => {
	const decision = evaluateWrite({
		strings: collectStrings(
			writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "verified", evidence: "hand-typed claim" })),
		),
		readReceipt: () => ({ state: "verified", evidence: "verified just now: real gate output", generated_at: Date.now() / 1000 }),
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /does not match/);
});

test("denies when the matching receipt is older than the freshness window", () => {
	const sixHoursMs = 6 * 60 * 60 * 1000;
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "verified", evidence: "e" }))),
		readReceipt: () => ({ state: "verified", evidence: "e", generated_at: (Date.now() - sixHoursMs - 1000) / 1000 }),
		now: () => Date.now(),
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /stale/);
});

test("denies when the receipt timestamp is in the future (clock skew)", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "verified", evidence: "e" }))),
		readReceipt: () => ({ state: "verified", evidence: "e", generated_at: (Date.now() + 60_000) / 1000 }),
		now: () => Date.now(),
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /stale/);
});

test("allows a fresh, exact-matching receipt", () => {
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", overlayBlock({ state: "verified", evidence: "e" }))),
		readReceipt: () => ({ state: "verified", evidence: "e", generated_at: Date.now() / 1000 }),
		now: () => Date.now(),
	});
	assert.deepEqual(decision, { kind: "allow" });
});

test("checks every func block in a multi-block write, not just the first", () => {
	const good = overlayBlock({ addr: "0x1", state: "verified", evidence: "e" });
	const bad = overlayBlock({ addr: "0x2", state: "verified", evidence: "fabricated" });
	const decision = evaluateWrite({
		strings: collectStrings(writeArgs("tools/census/state_overlay.toml", good + "\n" + bad)),
		readReceipt: (fileName) =>
			fileName === "1.json" ? { state: "verified", evidence: "e", generated_at: Date.now() / 1000 } : null,
	});
	assert.equal(decision.kind, "deny");
	assert.match(decision.reason, /0x2/);
});
