import { test } from "node:test";
import assert from "node:assert/strict";
import { toSessionInfo } from "./session-info.js";

test("maps a dsh SessionHeader to an ACP SessionInfo", () => {
	const info = toSessionInfo({ version: 1, id: "session-1", createdAt: 1700000000000, cwd: "/home/lance/git/dsh_config" });
	assert.deepEqual(info, {
		sessionId: "session-1",
		cwd: "/home/lance/git/dsh_config",
		updatedAt: new Date(1700000000000).toISOString(),
	});
});

test("falls back to an empty cwd when the header has none", () => {
	const info = toSessionInfo({ version: 1, id: "session-1", createdAt: 1700000000000 });
	assert.equal(info.cwd, "");
});
