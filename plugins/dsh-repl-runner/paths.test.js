import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveDshHome, historyFilePath, transcriptFilePath } from "./paths.js";

test("resolveDshHome honors $DSH_HOME when set", () => {
	const previous = process.env.DSH_HOME;
	process.env.DSH_HOME = "/tmp/some-dsh-home";
	try {
		assert.equal(resolveDshHome(), "/tmp/some-dsh-home");
	} finally {
		if (previous === undefined) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previous;
	}
});

test("resolveDshHome falls back to ~/.dsh when unset", () => {
	const previous = process.env.DSH_HOME;
	delete process.env.DSH_HOME;
	try {
		assert.equal(resolveDshHome(), join(homedir(), ".dsh"));
	} finally {
		if (previous === undefined) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previous;
	}
});

test("historyFilePath lives under <dshHome>/repl-runner/", () => {
	assert.equal(historyFilePath("/tmp/dsh-home"), join("/tmp/dsh-home", "repl-runner", "history"));
});

test("transcriptFilePath is keyed by session id under <dshHome>/repl-runner/transcripts/", () => {
	assert.equal(
		transcriptFilePath("session-abc123", "/tmp/dsh-home"),
		join("/tmp/dsh-home", "repl-runner", "transcripts", "session-abc123.log"),
	);
});
