import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMagicCommand, MAGIC_COMMANDS } from "./magic-commands.js";

test("a plain chat line is not a magic command", () => {
	assert.equal(parseMagicCommand("what's the weather"), null);
});

test("a bare slash-command with no args", () => {
	assert.deepEqual(parseMagicCommand("/help"), { name: "help", args: "" });
});

test("a slash-command with a single argument", () => {
	assert.deepEqual(parseMagicCommand("/history 5"), { name: "history", args: "5" });
});

test("a slash-command with a path argument containing spaces is kept whole", () => {
	assert.deepEqual(parseMagicCommand("/save my notes/session one.log"), {
		name: "save",
		args: "my notes/session one.log",
	});
});

test("command names are case-insensitive", () => {
	assert.deepEqual(parseMagicCommand("/HISTORY"), { name: "history", args: "" });
});

test("surrounding whitespace is trimmed", () => {
	assert.deepEqual(parseMagicCommand("   /clear   "), { name: "clear", args: "" });
});

test("an unrecognized slash-command is reported as unknown, not silently ignored", () => {
	assert.deepEqual(parseMagicCommand("/bogus"), { name: "unknown", args: "bogus" });
});

test("MAGIC_COMMANDS documents every dispatchable command with help text", () => {
	for (const command of MAGIC_COMMANDS) {
		assert.equal(typeof command.name, "string");
		assert.equal(typeof command.help, "string");
		assert.ok(command.help.length > 0);
	}
	const names = MAGIC_COMMANDS.map((c) => c.name);
	assert.deepEqual(
		[...names].sort(),
		["clear", "exit", "help", "history", "quit", "reload", "save"].sort(),
	);
});
