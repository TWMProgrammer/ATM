/* Git Commands — domain types.
 * Shared by categories.ts, builder.ts, and the host entry point. */

export interface GitCommand {
	readonly command: string;
	readonly desc: string;
	readonly icon: string;
}

export interface GitCategory {
	readonly name: string;
	readonly color: string;
	readonly icon: string;
	readonly commands: GitCommand[];
}
