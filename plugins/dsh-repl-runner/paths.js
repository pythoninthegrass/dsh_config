/**
 * Storage locations under $DSH_HOME (~/.dsh) for this plugin's own
 * cross-process state: persistent input history and per-session
 * transcripts. Distinct from dsh-session's own durable event log, whose
 * storage backend and location are dsh-session's concern, not ours.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export function resolveDshHome() {
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}

/** @param {string} [dshHome] */
export function historyFilePath(dshHome = resolveDshHome()) {
	return join(dshHome, "repl-runner", "history");
}

/**
 * @param {string} sessionId
 * @param {string} [dshHome]
 */
export function transcriptFilePath(sessionId, dshHome = resolveDshHome()) {
	return join(dshHome, "repl-runner", "transcripts", `${sessionId}.log`);
}
