import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { execFile } from 'child_process';

// ─── Helper: File existence check ──────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ─── Download Utilities ─────────────────────────────────────────────

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  percentage: number | null;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export async function downloadFile(
  url: string,
  destination: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const protocol = url.startsWith('https') ? https : http;

  const destDir = path.dirname(destination);
  await fs.promises.mkdir(destDir, { recursive: true });

  try {
    await fs.promises.unlink(destination);
  } catch {
    // File doesn't exist, that's fine
  }

  const file = fs.createWriteStream(destination, { flags: 'wx' });

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (
        response.statusCode === 302 ||
        response.statusCode === 301 ||
        response.statusCode === 307
      ) {
        if (response.headers.location) {
          const redirectUrl = new URL(
            response.headers.location,
            url,
          ).toString();
          file.close();
          downloadFile(redirectUrl, destination, onProgress)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.promises.unlink(destination).catch(() => {});
        reject(
          new Error(
            `Failed to download file: ${response.statusCode} ${response.statusMessage}`,
          ),
        );
        return;
      }

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
            percentage: totalBytes
              ? Math.round((bytesDownloaded / totalBytes) * 100)
              : null,
          });
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.end(() => {
          file.close();
          fs.promises
            .stat(destination)
            .then((stats) => {
              if (stats.size === 0) {
                reject(new Error(`Downloaded file is empty: ${destination}`));
                return;
              }
              resolve();
            })
            .catch((err) => {
              const errorMessage =
                err instanceof Error ? err.message : String(err);
              reject(
                new Error(`Error verifying downloaded file: ${errorMessage}`),
              );
            });
        });
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.promises.unlink(destination).catch(() => {});
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      fs.promises.unlink(destination).catch(() => {});
      reject(err);
    });
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Piper Installer ────────────────────────────────────────────────

const PIPER_RELEASE_BASE =
  'https://github.com/rhasspy/piper/releases/download/2023.11.14-2';

interface PiperBinaryInfo {
  url: string;
  dirName: string;
  isTarGz: boolean;
  sha256: string;
}

// Pinned from the 2023.11.14-2 GitHub release assets. Verified against a
// direct download of each asset before making the extracted binary executable,
// so a compromised or tampered asset is rejected before it can run.
const PIPER_SHA256: Record<string, string> = {
  piper_windows_amd64: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efce',
  piper_macos_aarch64: '6b1eb03b3735946cb35216e063e7eebcc33a6bbf5dd96ec0217959bf1cdcb0c',
  piper_macos_x64: 'ced85c0a3df13945b1e623b878a48fdc2854d5c485b4b67f62857cf551deaf8',
  piper_linux_aarch64: 'fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88e',
  piper_linux_armv7l: 'c6946fcd57c705ed1d4666ea880f80ba0bbbd14de62ecbdd13460baf3bac8e3',
  piper_linux_x86_64: 'a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e22599',
};

function getPiperDownloadInfo(): PiperBinaryInfo {
  const platform = process.platform;
  const arch = process.arch;

  switch (platform) {
    case 'win32':
      return {
        url: `${PIPER_RELEASE_BASE}/piper_windows_amd64.zip`,
        dirName: 'windows_amd64',
        isTarGz: false,
        sha256: PIPER_SHA256.piper_windows_amd64,
      };
    case 'darwin':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_macos_aarch64.tar.gz`,
          dirName: 'macos_aarch64',
          isTarGz: true,
          sha256: PIPER_SHA256.piper_macos_aarch64,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_macos_x64.tar.gz`,
        dirName: 'macos_x64',
        isTarGz: true,
        sha256: PIPER_SHA256.piper_macos_x64,
      };
    case 'linux':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_aarch64.tar.gz`,
          dirName: 'linux_aarch64',
          isTarGz: true,
          sha256: PIPER_SHA256.piper_linux_aarch64,
        };
      }
      if (arch === 'arm') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_armv7l.tar.gz`,
          dirName: 'linux_armv7l',
          isTarGz: true,
          sha256: PIPER_SHA256.piper_linux_armv7l,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_linux_x86_64.tar.gz`,
        dirName: 'linux_x86_64',
        isTarGz: true,
        sha256: PIPER_SHA256.piper_linux_x86_64,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Computes the SHA-256 digest of a file on disk.
 */
function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function isPiperInstalled(piperPath: string): Promise<boolean> {
  return fileExists(piperPath);
}

export async function installPiper(
  piperDir: string,
  piperPath: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<void> {
  const info = getPiperDownloadInfo();
  const targetDir = path.join(piperDir, info.dirName);

  await fs.promises.mkdir(piperDir, { recursive: true });

  const tempFileName = info.isTarGz
    ? 'piper-download.tar.gz'
    : 'piper-download.zip';
  const tempFile = path.join(os.tmpdir(), tempFileName);

  progress.report({ message: 'Downloading Piper TTS engine...' });

  try {
    await downloadFile(info.url, tempFile, (p) => {
      const pct = p.percentage ?? 0;
      const size = formatBytes(p.bytesDownloaded);
      progress.report({
        message: `Downloading Piper engine... ${pct}% (${size})`,
      });
    });

    progress.report({ message: 'Verifying download integrity...' });

    const actualDigest = await sha256File(tempFile);
    if (actualDigest !== info.sha256) {
      throw new Error(
        `Piper download failed integrity check (expected ${info.sha256}, got ${actualDigest}). The file was not installed.`,
      );
    }

    progress.report({ message: 'Extracting Piper engine...' });

    if (info.isTarGz) {
      await extractTarGz(tempFile, piperDir, info.dirName);
    } else {
      await extractZip(tempFile, piperDir, info.dirName);
    }

    if (os.platform() === 'linux' || os.platform() === 'darwin') {
      await setPermissions(targetDir);
    }

    if (os.platform() === 'linux') {
      await fixSymlinks(targetDir);
    }

    if (!(await fileExists(piperPath))) {
      throw new Error(
        `Piper binary not found after extraction at: ${piperPath}`,
      );
    }

    progress.report({ message: 'Piper engine installed!' });
  } finally {
    try {
      await fs.promises.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ─── Archive Extraction ─────────────────────────────────────────────

async function extractTarGz(
  archivePath: string,
  outputDir: string,
  targetDirName: string,
): Promise<void> {
  const tempExtractDir = path.join(outputDir, '_temp_extract');

  await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
  await fs.promises.mkdir(tempExtractDir, { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      execFile('tar', ['xzf', archivePath, '-C', tempExtractDir], (error) => {
        if (error) {
          reject(new Error(`Failed to extract archive: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    await fs.promises
      .rm(tempExtractDir, { recursive: true, force: true })
      .catch(() => {});
    throw error;
  }

  try {
    const extractedPiperDir = path.join(tempExtractDir, 'piper');
    const finalDir = path.join(outputDir, targetDirName);
    const extractedExists = await fileExists(extractedPiperDir);

    await fs.promises
      .rm(finalDir, { recursive: true, force: true })
      .catch(() => {});

    if (!extractedExists) {
      await fs.promises.rename(tempExtractDir, finalDir);
    } else {
      await fs.promises.rename(extractedPiperDir, finalDir);
      await fs.promises
        .rm(tempExtractDir, { recursive: true, force: true })
        .catch(() => {});
    }
  } catch (err) {
    await fs.promises
      .rm(tempExtractDir, { recursive: true, force: true })
      .catch(() => {});
    throw err;
  }
}

async function extractZip(
  archivePath: string,
  outputDir: string,
  targetDirName: string,
): Promise<void> {
  const tempExtractDir = path.join(outputDir, '_temp_extract');

  await fs.promises.rm(tempExtractDir, { recursive: true, force: true });
  await fs.promises.mkdir(tempExtractDir, { recursive: true });

  const cmd = 'powershell.exe';
  const args = [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractDir}' -Force`,
  ];

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (error) => {
        if (error) {
          reject(new Error(`Failed to extract archive: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    await fs.promises
      .rm(tempExtractDir, { recursive: true, force: true })
      .catch(() => {});
    throw error;
  }

  try {
    const extractedPiperDir = path.join(tempExtractDir, 'piper');
    const finalDir = path.join(outputDir, targetDirName);
    const extractedExists = await fileExists(extractedPiperDir);

    await fs.promises
      .rm(finalDir, { recursive: true, force: true })
      .catch(() => {});

    if (!extractedExists) {
      await fs.promises.rename(tempExtractDir, finalDir);
    } else {
      await fs.promises.rename(extractedPiperDir, finalDir);
      await fs.promises
        .rm(tempExtractDir, { recursive: true, force: true })
        .catch(() => {});
    }
  } catch (err) {
    await fs.promises
      .rm(tempExtractDir, { recursive: true, force: true })
      .catch(() => {});
    throw err;
  }
}

async function setPermissions(dir: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) {
        const name = file.toLowerCase();
        if (
          name === 'piper' ||
          name === 'espeak-ng' ||
          name === 'piper_phonemize' ||
          name.endsWith('.so') ||
          name.includes('.so.')
        ) {
          await fs.promises.chmod(filePath, 0o755);
        }
      }
    }
  } catch (error) {
    console.error('[voice-tts] Error setting permissions:', error);
  }
}

// ─── Symlinks (Linux) ───────────────────────────────────────────────

interface SymlinkMapping {
  target: string;
  link: string;
}

function getSymlinkMappings(): SymlinkMapping[] {
  return [
    { target: 'libespeak-ng.so.1.52.0.1', link: 'libespeak-ng.so.1' },
    { target: 'libespeak-ng.so.1', link: 'libespeak-ng.so' },
    { target: 'libonnxruntime.so.1.14.1', link: 'libonnxruntime.so' },
    { target: 'libpiper_phonemize.so.1.2.0', link: 'libpiper_phonemize.so.1' },
    { target: 'libpiper_phonemize.so.1', link: 'libpiper_phonemize.so' },
  ];
}

export async function fixSymlinks(binaryDir: string): Promise<void> {
  if (process.platform !== 'linux') {
    return;
  }

  if (!(await fileExists(binaryDir))) {
    console.warn(`[voice-tts] Piper binary directory not found: ${binaryDir}`);
    return;
  }

  const symlinks = getSymlinkMappings();

  for (const { target, link } of symlinks) {
    await createSymlink(binaryDir, target, link);
  }
}

async function createSymlink(
  dir: string,
  target: string,
  link: string,
): Promise<void> {
  const linkPath = path.join(dir, link);
  const targetPath = path.join(dir, target);

  try {
    if (!(await fileExists(targetPath))) {
      console.warn(`[voice-tts] Target file not found: ${targetPath}`);
      return;
    }

    // Check if symlink already exists and points to correct target
    try {
      const existingTarget = await fs.promises.readlink(linkPath);
      if (existingTarget === target) {
        // Symlink already exists and is correct
        return;
      }
      // Remove incorrect symlink
      await fs.promises.unlink(linkPath);
    } catch {
      // Link doesn't exist or is not a symlink, proceed to create
    }

    await fs.promises.symlink(target, linkPath);
    console.log(`[voice-tts] Created symlink: ${link} -> ${target}`);
  } catch (error) {
    console.error(
      `[voice-tts] Failed to create symlink ${link} -> ${target}:`,
      error,
    );
  }
}
