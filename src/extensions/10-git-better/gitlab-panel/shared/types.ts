/**
 * Shared type definitions for the GitLab Panel.
 * Used by both backend (core/) and frontend (panels/) code.
 */

/** Represents the commit data displayed in the Inspect panel. */
export interface InspectCommitData {
    hash: string;
    authorName: string;
    authorAvatar: string;
    authorAvatarUrl?: string | null;
    message: string;
    date: string;
    stats: {
        added: number;
        deleted: number;
    };
    files: Array<{
        status: string; // e.g., 'M', 'A', 'D'
        name: string;
    }>;
    githubUrl: string | null;
}

/** Represents a data point in the Graphics logic (Minimap/Sparkline). */
export interface GraphicsCommitData {
    hash: string;
    timestamp: number;
    author: string;
    date: string;
    linesChanged: number; // For determining the height of the curve
    isHead: boolean;      // For drawing the active node/branch head differently
}

/** Represents the global metrics for the left sidebar */
export interface StatsData {
    branches: number;
    commits: number;
    tags: number;
    stashes: number;
}

/** Represents a single commit row in the commits table */
export interface CommitRowData {
    hash: string;
    hashShort: string;
    authorName: string;
    authorEmail: string;
    authorAvatarUrl?: string;
    committerName: string;
    committerEmail: string;
    committerAvatarUrl?: string;
    authorInitial: string;
    message: string;
    date: string;
    filesChanged: number;
    branch: string;     // branch name (only populated for HEAD of each branch)
    isHead: boolean;    // is this the HEAD commit of the current branch?
}
