'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PackageManifest, readManifest } from '../core/manifest';

// ======================================
// RUN DEV — PROJECT RESOLUTION | MARK: PROJECT
// ======================================
//
// Decides which package.json to run: the one nearest the active file, the sole
// project in the workspace, or a quick-pick in a monorepo.

export interface ResolvedProject {
  dir: string;
  manifest: PackageManifest;
}

/** Nearest ancestor (inclusive) of `startDir` that holds a package.json, bounded by `stopDir`. */
function nearestPackageJson(startDir: string, stopDir: string): string | undefined {
  let current = startDir;
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    if (current === stopDir) {
      return undefined;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/** Every project root: each workspace folder plus its immediate sub-projects (monorepo apps). */
function gatherCandidates(folders: readonly vscode.WorkspaceFolder[]): string[] {
  const dirs = new Set<string>();
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    if (fs.existsSync(path.join(root, 'package.json'))) {
      dirs.add(root);
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      const dir = path.join(root, entry.name);
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        dirs.add(dir);
      }
    }
  }
  return [...dirs];
}

function toProject(dir: string): ResolvedProject | undefined {
  const manifest = readManifest(dir);
  return manifest ? { dir, manifest } : undefined;
}

export async function resolveProject(fileUri?: vscode.Uri): Promise<ResolvedProject | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage(
      vscode.l10n.t('ATM Run Dev: open a folder or workspace first (File → Open Folder).')
    );
    return undefined;
  }

  // 1) Prefer the project owning the active/clicked file.
  const activePath = fileUri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (activePath) {
    const owner = folders.find((folder) => activePath.startsWith(folder.uri.fsPath));
    if (owner) {
      const near = nearestPackageJson(path.dirname(activePath), owner.uri.fsPath);
      const project = near ? toProject(near) : undefined;
      if (project) {
        return project;
      }
    }
  }

  // 2) Otherwise use the sole candidate, or ask in a monorepo.
  const candidates = gatherCandidates(folders);
  if (candidates.length === 0) {
    void vscode.window.showErrorMessage(
      vscode.l10n.t('ATM Run Dev: no package.json found in the workspace.')
    );
    return undefined;
  }
  if (candidates.length === 1) {
    return toProject(candidates[0]);
  }

  const rootPaths = folders.map((folder) => folder.uri.fsPath);
  const picked = await vscode.window.showQuickPick(
    candidates.map((dir) => ({
      label: path.basename(dir),
      description: relativeToRoots(dir, rootPaths),
      dir,
    })),
    { placeHolder: vscode.l10n.t('Choose the project to run'), ignoreFocusOut: true }
  );
  return picked ? toProject(picked.dir) : undefined;
}

function relativeToRoots(dir: string, roots: string[]): string {
  for (const root of roots) {
    if (dir === root) {
      return '.';
    }
    if (dir.startsWith(root + path.sep)) {
      return path.relative(root, dir);
    }
  }
  return dir;
}
