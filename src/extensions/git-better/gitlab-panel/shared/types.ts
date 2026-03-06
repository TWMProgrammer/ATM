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
