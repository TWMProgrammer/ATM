/**
 * Piper TTS engine installer.
 * Downloads and extracts the Piper binary for the current platform
 * automatically when the first voice is downloaded.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { getPiperDownloadInfo } from './config';
import { getResourcesBasePath, getPiperPath } from './paths';
import { downloadFile, formatBytes } from './download';
import { fixSymlinks } from './symlinks';

/**
 * Check if Piper engine is installed.
 */
export function isPiperInstalled(context: vscode.ExtensionContext): boolean {
    try {
        const piperPath = getPiperPath(context);
        return fs.existsSync(piperPath);
    } catch {
        return false;
    }
}

/**
 * Download and install Piper TTS engine.
 * Called automatically during the first voice download.
 */
export async function installPiper(
    context: vscode.ExtensionContext,
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
    const info = getPiperDownloadInfo();
    const baseDir = getResourcesBasePath(context);
    const piperDir = path.join(baseDir, 'piper');
    const targetDir = path.join(piperDir, info.dirName);

    // Create directories
    if (!fs.existsSync(piperDir)) {
        fs.mkdirSync(piperDir, { recursive: true });
    }

    // Download to temp file
    const tempFileName = info.isTarGz ? 'piper-download.tar.gz' : 'piper-download.zip';
    const tempFile = path.join(os.tmpdir(), tempFileName);

    progress.report({ message: 'Downloading Piper TTS engine...' });

    try {
        await downloadFile(info.url, tempFile, (p) => {
            const pct = p.percentage ?? 0;
            const size = formatBytes(p.bytesDownloaded);
            progress.report({
                message: `Downloading Piper engine... ${pct}% (${size})`
            });
        });

        // Extract
        progress.report({ message: 'Extracting Piper engine...' });

        if (info.isTarGz) {
            await extractTarGz(tempFile, piperDir, info.dirName);
        } else {
            await extractZip(tempFile, piperDir, info.dirName);
        }

        // Set execute permissions on Linux/macOS
        if (os.platform() === 'linux' || os.platform() === 'darwin') {
            setPermissions(targetDir);
        }

        // Fix symlinks on Linux
        if (os.platform() === 'linux') {
            await fixSymlinks(baseDir);
        }

        // Verify installation
        const piperPath = getPiperPath(context);
        if (!fs.existsSync(piperPath)) {
            throw new Error(`Piper binary not found after extraction at: ${piperPath}`);
        }

        progress.report({ message: 'Piper engine installed!' });
    } finally {
        // Clean up temp file
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Extract a tar.gz archive.
 * The archive contains a `piper/` folder — we rename it to the platform dir name.
 */
function extractTarGz(archivePath: string, outputDir: string, targetDirName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // First extract to a temp location, then move
        const tempExtractDir = path.join(outputDir, '_temp_extract');

        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true });
        }
        fs.mkdirSync(tempExtractDir, { recursive: true });

        execFile('tar', ['xzf', archivePath, '-C', tempExtractDir], (error) => {
            if (error) {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
                reject(new Error(`Failed to extract archive: ${error.message}`));
                return;
            }

            try {
                // The archive extracts to a `piper/` subfolder
                const extractedPiperDir = path.join(tempExtractDir, 'piper');
                const finalDir = path.join(outputDir, targetDirName);

                if (!fs.existsSync(extractedPiperDir)) {
                    // Maybe extracted directly without subfolder
                    // Move temp contents to target
                    if (fs.existsSync(finalDir)) {
                        fs.rmSync(finalDir, { recursive: true });
                    }
                    fs.renameSync(tempExtractDir, finalDir);
                } else {
                    // Move extracted piper/ to the platform-specific dir
                    if (fs.existsSync(finalDir)) {
                        fs.rmSync(finalDir, { recursive: true });
                    }
                    fs.renameSync(extractedPiperDir, finalDir);
                    fs.rmSync(tempExtractDir, { recursive: true, force: true });
                }

                resolve();
            } catch (err) {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
                reject(err);
            }
        });
    });
}

/**
 * Extract a zip archive (Windows).
 */
function extractZip(archivePath: string, outputDir: string, targetDirName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const tempExtractDir = path.join(outputDir, '_temp_extract');

        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true });
        }
        fs.mkdirSync(tempExtractDir, { recursive: true });

        // Use PowerShell on Windows to extract
        const cmd = 'powershell.exe';
        const args = [
            '-NoProfile', '-Command',
            `Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractDir}' -Force`
        ];

        execFile(cmd, args, (error) => {
            if (error) {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
                reject(new Error(`Failed to extract archive: ${error.message}`));
                return;
            }

            try {
                const extractedPiperDir = path.join(tempExtractDir, 'piper');
                const finalDir = path.join(outputDir, targetDirName);

                if (!fs.existsSync(extractedPiperDir)) {
                    if (fs.existsSync(finalDir)) {
                        fs.rmSync(finalDir, { recursive: true });
                    }
                    fs.renameSync(tempExtractDir, finalDir);
                } else {
                    if (fs.existsSync(finalDir)) {
                        fs.rmSync(finalDir, { recursive: true });
                    }
                    fs.renameSync(extractedPiperDir, finalDir);
                    fs.rmSync(tempExtractDir, { recursive: true, force: true });
                }

                resolve();
            } catch (err) {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
                reject(err);
            }
        });
    });
}

/**
 * Set execute permissions on all binaries in the directory.
 */
function setPermissions(dir: string): void {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                // Set executable for piper, espeak-ng, piper_phonemize, and .so files
                const name = file.toLowerCase();
                if (name === 'piper' || name === 'espeak-ng' || name === 'piper_phonemize' ||
                    name.endsWith('.so') || name.includes('.so.')) {
                    fs.chmodSync(filePath, 0o755);
                }
            }
        }
    } catch (error) {
        console.error('[voice-tts] Error setting permissions:', error);
    }
}
