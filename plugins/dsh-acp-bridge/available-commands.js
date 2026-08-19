/**
 * Map dsh's `CommandRuntime.list(agent)` descriptors to ACP `AvailableCommand[]`
 * for the `available_commands_update` session/update variant.
 *
 * @param {readonly {name: string, description: string, input?: {hint: string}}[]} descriptors
 * @returns {object[]}
 */
export function toAvailableCommands(descriptors) {
	return descriptors.map((descriptor) => ({
		name: descriptor.name,
		description: descriptor.description,
		...(descriptor.input === undefined ? {} : { input: descriptor.input }),
	}));
}
