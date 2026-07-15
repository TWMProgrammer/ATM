import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { usesLegacyNpmToken } from '../extensions/24-npm-run/core/detector';
import { createPublishWorkflow, migrateLegacyPublishWorkflow } from '../extensions/24-npm-run/core/setup';

suite('NPM Run OIDC workflow', () => {
    test('creates a tokenless OIDC workflow with beta support', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-npm-run-'));
        try {
            const workflowPath = createPublishWorkflow(root);
            const workflow = fs.readFileSync(workflowPath, 'utf8');

            assert.match(workflow, /id-token: write/);
            assert.match(workflow, /npm publish --provenance --access public --tag beta/);
            assert.strictEqual(usesLegacyNpmToken(workflow), false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('migrates the old ATM token workflow', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-npm-run-'));
        const workflowPath = path.join(root, 'publish.yml');
        const legacy = `jobs:
  publish:
    permissions:
      id-token: write
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Publish with provenance
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
        fs.writeFileSync(workflowPath, legacy, 'utf8');

        try {
            assert.strictEqual(migrateLegacyPublishWorkflow(workflowPath), true);
            const workflow = fs.readFileSync(workflowPath, 'utf8');

            assert.strictEqual(usesLegacyNpmToken(workflow), false);
            assert.match(workflow, /node-version: '22'/);
            assert.match(workflow, /npm install -g npm@latest/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
