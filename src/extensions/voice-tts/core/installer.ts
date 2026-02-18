import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { execFile } from 'child_process';

// ─── Download Utilities ─────────────────────────────────────────────

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  percentage: number | null;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export function downloadFile(
  url: string,
  destination: string,
  onProgress?: ProgressCallback,
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
        console.error(
          `[voice-tts] Error removing existing file ${destination}:`,
          err,
        );
      }
    }

    const file = fs.createWriteStream(destination, { flags: 'wx' });

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
        fs.unlink(destination, () => {});
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
          try {
            const stats = fs.statSync(destination);
            if (stats.size === 0) {
              reject(new Error(`Downloaded file is empty: ${destination}`));
              return;
            }
            resolve();
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            reject(
              new Error(`Error verifying downloaded file: ${errorMessage}`),
            );
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
}

function getPiperDownloadInfo(): PiperBinaryInfo {
  const platform = process.platform;
  const arch = process.arch;

  switch (platform) {
    case 'win32':
      return {
        url: `${PIPER_RELEASE_BASE}/piper_windows_amd64.zip`,
        dirName: 'windows_amd64',
        isTarGz: false,
      };
    case 'darwin':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_macos_aarch64.tar.gz`,
          dirName: 'macos_aarch64',
          isTarGz: true,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_macos_x64.tar.gz`,
        dirName: 'macos_x64',
        isTarGz: true,
      };
    case 'linux':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_aarch64.tar.gz`,
          dirName: 'linux_aarch64',
          isTarGz: true,
        };
      }
      if (arch === 'arm') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_armv7l.tar.gz`,
          dirName: 'linux_armv7l',
          isTarGz: true,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_linux_x86_64.tar.gz`,
        dirName: 'linux_x86_64',
        isTarGz: true,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function isPiperInstalled(piperPath: string): boolean {
  try {
    return fs.existsSync(piperPath);
  } catch {
    return false;
  }
}

export async function installPiper(
  piperDir: string,
  piperPath: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<void> {
  const info = getPiperDownloadInfo();
  const targetDir = path.join(piperDir, info.dirName);

  if (!fs.existsSync(piperDir)) {
    fs.mkdirSync(piperDir, { recursive: true });
  }

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

    progress.report({ message: 'Extracting Piper engine...' });

    if (info.isTarGz) {
      await extractTarGz(tempFile, piperDir, info.dirName);
    } else {
      await extractZip(tempFile, piperDir, info.dirName);
    }

    if (os.platform() === 'linux' || os.platform() === 'darwin') {
      setPermissions(targetDir);
    }

    if (os.platform() === 'linux') {
      await fixSymlinks(targetDir);
    }

    if (!fs.existsSync(piperPath)) {
      throw new Error(
        `Piper binary not found after extraction at: ${piperPath}`,
      );
    }

    progress.report({ message: 'Piper engine installed!' });
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ─── Archive Extraction ─────────────────────────────────────────────

function extractTarGz(
  archivePath: string,
  outputDir: string,
  targetDirName: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
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

function extractZip(
  archivePath: string,
  outputDir: string,
  targetDirName: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempExtractDir = path.join(outputDir, '_temp_extract');

    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true });
    }
    fs.mkdirSync(tempExtractDir, { recursive: true });

    const cmd = 'powershell.exe';
    const args = [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractDir}' -Force`,
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

function setPermissions(dir: string): void {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const name = file.toLowerCase();
        if (
          name === 'piper' ||
          name === 'espeak-ng' ||
          name === 'piper_phonemize' ||
          name.endsWith('.so') ||
          name.includes('.so.')
        ) {
          fs.chmodSync(filePath, 0o755);
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

  if (!fs.existsSync(binaryDir)) {
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
    if (!fs.existsSync(targetPath)) {
      console.warn(`[voice-tts] Target file not found: ${targetPath}`);
      return;
    }

    if (fs.existsSync(linkPath)) {
      await fs.promises.unlink(linkPath);
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
