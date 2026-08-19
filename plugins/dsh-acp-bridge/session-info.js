/**
 * Map a dsh `SessionHeader` (from `SessionPersistence.list`) to an ACP
 * `SessionInfo` entry for the `session/list` response.
 *
 * @param {{id: string, cwd?: string, createdAt: number}} header
 * @returns {object}
 */
export function toSessionInfo(header) {
	return {
		sessionId: header.id,
		cwd: header.cwd ?? "",
		updatedAt: new Date(header.createdAt).toISOString(),
	};
}
