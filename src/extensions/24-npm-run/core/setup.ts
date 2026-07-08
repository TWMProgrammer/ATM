import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitHubRepo } from './git';

/**
 * Publish-on-tag workflow with npm provenance. Prerelease tags (v1.2.3-beta.0)
 * are published under the "beta" dist-tag so normal users never install them.
 */
const PUBLISH_WORKFLOW = `name: Publish

on:
  push:
    tags:
      - 'v*'

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
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Publish with provenance
        run: |
          if [[ "$GITHUB_REF_NAME" == *-* ]]; then
            npm publish --provenance --access public --tag beta
          else
            npm publish --provenance --access public
          fi
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;

export function createPublishWorkflow(repoRoot: string): string {
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const filePath = path.join(workflowsDir, 'publish.yml');
    if (fs.existsSync(filePath)) {
        throw new Error(vscode.l10n.t('{0} already exists.', filePath));
    }
    fs.writeFileSync(filePath, PUBLISH_WORKFLOW, 'utf8');
    return filePath;
}

export async function showTokenChecklist(github: GitHubRepo | undefined): Promise<void> {
    const openNpmTokens = vscode.l10n.t('Open npm tokens');
    const openGithubSecrets = vscode.l10n.t('Open GitHub secrets');
    const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t(
            'publish.yml created. One manual step is left: create a granular npm token (read/write, only this package) and save it in the GitHub repo as a secret named NPM_TOKEN. Then commit and push publish.yml.'
        ),
        openNpmTokens,
        openGithubSecrets
    );
    if (choice === openNpmTokens) {
        void vscode.env.openExternal(vscode.Uri.parse('https://www.npmjs.com/settings/~/tokens'));
    } else if (choice === openGithubSecrets && github) {
        void vscode.env.openExternal(
            vscode.Uri.parse(`https://github.com/${github.owner}/${github.repo}/settings/secrets/actions`)
        );
    }
}

/** Opens a terminal with the first-publish login command pre-typed but not executed. */
export function openFirstPublishTerminal(pkgDir: string): void {
    const terminal = vscode.window.createTerminal({ name: 'npm first publish', cwd: pkgDir });
    terminal.show();
    terminal.sendText('npm login --auth-type=web', false);
}
