import { GitCommitInfo, BlameLineInfo } from './types';

// A simple in-memory cache to store blame information per file
export class CacheManager {
    // Map of filepath -> (Map of line number -> BlameLineInfo)
    private fileBlameCache: Map<string, Map<number, BlameLineInfo>> = new Map();
    // Map of commitHash -> GitCommitInfo
    private commitCache: Map<string, GitCommitInfo> = new Map();

    public clearCache(filepath: string) {
        this.fileBlameCache.delete(filepath);
    }

    public clearAll() {
        this.fileBlameCache.clear();
        this.commitCache.clear();
    }

    public getBlameLineInfo(filepath: string, line: number): BlameLineInfo | undefined {
        const fileCache = this.fileBlameCache.get(filepath);
        return fileCache?.get(line);
    }

    public getCommitInfo(hash: string): GitCommitInfo | undefined {
        return this.commitCache.get(hash);
    }

    public setBlameLineInfo(filepath: string, line: number, info: BlameLineInfo) {
        let fileCache = this.fileBlameCache.get(filepath);
        if (!fileCache) {
            fileCache = new Map();
            this.fileBlameCache.set(filepath, fileCache);
        }
        fileCache.set(line, info);
    }

    public setCommitInfo(hash: string, info: GitCommitInfo) {
        this.commitCache.set(hash, info);
    }
    
    public hasFileBlame(filepath: string): boolean {
        return this.fileBlameCache.has(filepath);
    }
}
