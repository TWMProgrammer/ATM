import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitHubRepo } from './git';

const PUBLISH_WORKFLOW = `name: Publish

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      - name: Update npm
        run: npm install -g npm@latest

      - name: Publish with provenance
        run: |
          if [[ "$GITHUB_REF_NAME" == *-* ]]; then
            npm publish --provenance --access public --tag beta
          else
            npm publish --provenance --access public
          fi
`;

const LEGACY_TOKEN_ENV = /\r?\n([ \t]+)env:[ \t]*\r?\n\1[ \t]+NODE_AUTH_TOKEN:[ \t]*\$\{\{[ \t]*secrets\.NPM_TOKEN[ \t]*\}\}[ \t]*(?=\r?\n|$)/;
const PUBLISH_STEP = /^([ \t]*)- name: Publish with provenance[ \t]*$/m;

export function createPublishWorkflow(repoRoot: string): string {
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    const filePath = path.join(workflowsDir, 'publish.yml');
    fs.mkdirSync(workflowsDir, { recursive: true });
    if (fs.existsSync(filePath)) {
        throw new Error(vscode.l10n.t('{0} already exists.', filePath));
    }
    fs.writeFileSync(filePath, PUBLISH_WORKFLOW, 'utf8');
    return filePath;
}

export function migrateLegacyPublishWorkflow(filePath: string): boolean {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!LEGACY_TOKEN_ENV.test(raw) || !/id-token:[ \t]*write/.test(raw)) {
        return false;
    }

    let updated = raw.replace(LEGACY_TOKEN_ENV, '');
    updated = updated.replace(/(node-version:[ \t]*)['"]?20['"]?/, "$1'22'");

    if (!/npm install -g npm@/.test(updated)) {
        if (!PUBLISH_STEP.test(updated)) {
            return false;
        }
        const eol = raw.includes('\r\n') ? '\r\n' : '\n';
        updated = updated.replace(PUBLISH_STEP, (_step, indent: string) => {
            return `${indent}- name: Update npm${eol}${indent}  run: npm install -g npm@latest${eol}${eol}${indent}- name: Publish with provenance`;
        });
    }

    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
}

export async function showOidcChecklist(
    packageName: string,
    github: GitHubRepo,
    workflowPath: string
): Promise<void> {
    const openNpm = vscode.l10n.t('Open npm access');
    const workflowName = path.basename(workflowPath);
    const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t(
            '{0} is ready for OIDC. On npm, add GitHub Actions as the trusted publisher: repository {1}/{2}, workflow {3}, and allow npm publish. No token or GitHub secret is needed. Commit this workflow before releasing.',
            workflowName,
            github.owner,
            github.repo,
            workflowName
        ),
        openNpm
    );
    if (choice === openNpm) {
        const encodedName = encodeURIComponent(packageName);
        void vscode.env.openExternal(vscode.Uri.parse(`https://www.npmjs.com/package/${encodedName}/access`));
    }
}
