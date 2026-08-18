import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeCompletions } from "./completion.js";

const COMMAND_NAMES = ["help", "history", "clear", "save", "reload", "exit", "quit"];

function withFixture(fn) {
	const cwd = mkdtempSync(join(tmpdir(), "repl-completion-cwd-"));
	const homeDir = mkdtempSync(join(tmpdir(), "repl-completion-home-"));
	writeFileSync(join(cwd, "foo.txt"), "");
	writeFileSync(join(cwd, "foobar.txt"), "");
	mkdirSync(join(cwd, "subdir"));
	writeFileSync(join(cwd, "subdir", "inner.txt"), "");
	writeFileSync(join(homeDir, "notes.md"), "");
	return Promise.resolve(fn({ cwd, homeDir })).finally(() => {
		rmSync(cwd, { recursive: true, force: true });
		rmSync(homeDir, { recursive: true, force: true });
	});
}

test("a line-initial slash completes against known magic commands", async () => {
	const [hits, matched] = await computeCompletions({ line: "/h", commandNames: COMMAND_NAMES });
	assert.deepEqual(hits.sort(), ["/help", "/history"].sort());
	assert.equal(matched, "/h");
});

test("a slash appearing mid-sentence does not trigger command completion", async () => {
	const [hits] = await computeCompletions({ line: "look in /hi", commandNames: COMMAND_NAMES, history: [] });
	assert.deepEqual(hits, []);
});

test("an @-token completes cwd-relative paths, keeping the @ prefix", async () => {
	await withFixture(async ({ cwd }) => {
		const [hits, matched] = await computeCompletions({ line: "see @foo", cwd });
		assert.deepEqual(hits.sort(), ["@foo.txt", "@foobar.txt"].sort());
		assert.equal(matched, "@foo");
	});
});

test("an @-token completion suffixes directories with a trailing slash", async () => {
	await withFixture(async ({ cwd }) => {
		const [hits] = await computeCompletions({ line: "@sub", cwd });
		assert.deepEqual(hits, ["@subdir/"]);
	});
});

test("an @-token with a directory portion lists inside that directory", async () => {
	await withFixture(async ({ cwd }) => {
		const [hits] = await computeCompletions({ line: "@subdir/in", cwd });
		assert.deepEqual(hits, ["@subdir/inner.txt"]);
	});
});

test("a plain relative-path token completes without an @ prefix", async () => {
	await withFixture(async ({ cwd }) => {
		const [hits, matched] = await computeCompletions({ line: "./foo", cwd });
		assert.deepEqual(hits.sort(), ["./foo.txt", "./foobar.txt"].sort());
		assert.equal(matched, "./foo");
	});
});

test("a ~/ token completes inside the home directory", async () => {
	await withFixture(async ({ cwd, homeDir }) => {
		const [hits] = await computeCompletions({ line: "~/not", cwd, homeDir });
		assert.deepEqual(hits, ["~/notes.md"]);
	});
});

test("an unmatched fs directory yields no completions instead of throwing", async () => {
	await withFixture(async ({ cwd }) => {
		const [hits] = await computeCompletions({ line: "no/such/dir/", cwd });
		assert.deepEqual(hits, []);
	});
});

test("a bare token falls back to a deduplicated prior-input prefix match", async () => {
	const [hits, matched] = await computeCompletions({
		line: "wha",
		history: ["what time is it", "what time is it", "whatever", "something else"],
	});
	assert.deepEqual(hits.sort(), ["what time is it", "whatever"].sort());
	assert.equal(matched, "wha");
});

test("history completion excludes an entry identical to what's already typed", () => {
	return computeCompletions({ line: "whatever", history: ["whatever"] }).then(([hits]) => {
		assert.deepEqual(hits, []);
	});
});

test("an empty line yields no completions", async () => {
	const [hits, matched] = await computeCompletions({ line: "", history: ["hello"] });
	assert.deepEqual(hits, []);
	assert.equal(matched, "");
});
