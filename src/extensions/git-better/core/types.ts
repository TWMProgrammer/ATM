export interface GitCommitInfo {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: Date;
  summary: string;
}

export interface BlameLineInfo {
  commitHash: string;
  originalLine: number;
  finalLine: number;
}

export interface LineDiffInfo {
  previous: string | null;
  current: string | null;
}
