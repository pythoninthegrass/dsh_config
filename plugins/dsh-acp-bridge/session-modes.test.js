import { test } from "node:test";
import assert from "node:assert/strict";
import { toSessionModeState } from "./session-modes.js";

test("maps agent presets to a SessionModeState with the current preset selected", () => {
	const presets = [
		{ id: "standard", name: "Standard" },
		{ id: "minimal", name: "Minimal", description: "Lean tool roster" },
		{ id: "broken-preset", broken: "missing composition.yml" },
	];
	assert.deepEqual(toSessionModeState(presets, "standard"), {
		currentModeId: "standard",
		availableModes: [
			{ id: "standard", name: "Standard" },
			{ id: "minimal", name: "Minimal", description: "Lean tool roster" },
		],
	});
});

test("falls back to a preset's id as its name when it published none", () => {
	const state = toSessionModeState([{ id: "standard" }], "standard");
	assert.equal(state.availableModes[0].name, "standard");
});
