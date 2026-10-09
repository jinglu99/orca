/**
 * Names, rather than spells out, the folder an Orca assistant chat launches in: the host resolves
 * it to its own `<userData>/orca-assistant`, so no client ever chooses a launch path. Only the
 * local host is asked for one, and a local host always runs the client's own build, so the field
 * needs no capability negotiation despite the create params being strict.
 */
export const ORCA_ASSISTANT_LAUNCH_DIRECTORY = 'orca-assistant' as const

export type OrcaAssistantLaunchDirectory = typeof ORCA_ASSISTANT_LAUNCH_DIRECTORY
