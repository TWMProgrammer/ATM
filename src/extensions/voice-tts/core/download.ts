/**
 * File download utilities for Voice TTS extension
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export interface DownloadProgress {
    bytesDownloaded: number;
    totalBytes: number | null;
    percentage: number | null;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download a file from a URL to a local destination.
 * Handles redirects (301, 302, 307) and reports progress.
 */
export function downloadFile(
    url: string,
    destination: string,
    onProgress?: ProgressCallback
): Promise<void> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        if (fs.existsSync(destination)) {
            try {
                fs.unlinkSync(destination);
            } catch (err) {
                console.error(`[voice-tts] Error removing existing file ${destination}:`, err);
            }
        }

        const file = fs.createWriteStream(destination, { flags: 'wx' });

        const request = protocol.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307) {
                if (response.headers.location) {
                    const redirectUrl = new URL(response.headers.location, url).toString();
                    file.close();
                    downloadFile(redirectUrl, destination, onProgress).then(resolve).catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(destination, () => {});
                reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
                return;
            }

            // Track download progress
            const totalBytes = response.headers['content-length'] 
                ? parseInt(response.headers['content-length'], 10) 
                : null;
            let bytesDownloaded = 0;

            response.on('data', (chunk: Buffer) => {
                bytesDownloaded += chunk.length;
                if (onProgress) {
                    onProgress({
                        bytesDownloaded,
                        totalBytes,
                        percentage: totalBytes ? Math.round((bytesDownloaded / totalBytes) * 100) : null
                    });
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.end(() => {
                    file.close();
                    try {
                        const stats = fs.statSync(destination);
                        if (stats.size === 0) {
                            reject(new Error(`Downloaded file is empty: ${destination}`));
                            return;
                        }
                        resolve();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        reject(new Error(`Error verifying downloaded file: ${errorMessage}`));
                    }
                });
            });
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(destination, () => {});
            reject(err);
        });

        file.on('error', (err) => {
            file.close();
            fs.unlink(destination, () => {});
            reject(err);
        });
    });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) { return `${bytes} B`; }
    if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
