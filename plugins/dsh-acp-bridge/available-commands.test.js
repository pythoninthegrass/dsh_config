import { test } from "node:test";
import assert from "node:assert/strict";
import { toAvailableCommands } from "./available-commands.js";

test("maps command descriptors to ACP available commands", () => {
	const descriptors = [
		{ name: "help", description: "Show help" },
		{ name: "save", description: "Save the transcript", input: { hint: "path" } },
	];
	assert.deepEqual(toAvailableCommands(descriptors), [
		{ name: "help", description: "Show help" },
		{ name: "save", description: "Save the transcript", input: { hint: "path" } },
	]);
});

test("empty descriptor list maps to an empty command list", () => {
	assert.deepEqual(toAvailableCommands([]), []);
});
