/**
 * Map dsh's `AgentPresets.list()` roster to an ACP `SessionModeState` for
 * advertising presets as `session/set_mode` modes. Broken presets are
 * dropped — they cannot compose a session, so they cannot be a mode.
 *
 * @param {readonly {id: string, name?: string, description?: string, broken?: string}[]} presets
 * @param {string} currentModeId
 * @returns {object}
 */
export function toSessionModeState(presets, currentModeId) {
	return {
		currentModeId,
		availableModes: presets
			.filter((preset) => preset.broken === undefined)
			.map((preset) => ({
				id: preset.id,
				name: preset.name ?? preset.id,
				...(preset.description === undefined ? {} : { description: preset.description }),
			})),
	};
}
