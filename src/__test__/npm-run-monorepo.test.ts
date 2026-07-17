import * as assert from 'assert';
import {
    createTagName,
    findWorkflowForPackage,
    parsePublishWorkflow,
    versionFromTag,
} from '../extensions/24-npm-run/core/workflow';

function packageWorkflow(workingDirectory: string, tagPattern: string): string {
    return `name: Publish package

on:
  push:
    tags:
      - "${tagPattern}"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish package
        working-directory: ${workingDirectory}
        run: npm publish --provenance --access public
`;
}

suite('NPM Run monorepo workflows', () => {
    test('matches each package to its working-directory', () => {
        const repoRoot = '/workspace/jilatax';
        const workflows = [
            parsePublishWorkflow('/workspace/jilatax/.github/workflows/cli.yml', packageWorkflow('packages/cli', 'cli-v*')),
            parsePublishWorkflow(
                '/workspace/jilatax/.github/workflows/create-jilatax.yml',
                packageWorkflow('packages/create-jilatax', 'create-jilatax-v*')
            ),
            parsePublishWorkflow(
                '/workspace/jilatax/.github/workflows/publish.yml',
                packageWorkflow('packages/jilatax', 'v*')
            ),
        ].filter((workflow) => workflow !== undefined);

        assert.strictEqual(
            findWorkflowForPackage(workflows, repoRoot, '/workspace/jilatax/packages/cli')?.tagPattern,
            'cli-v*'
        );
        assert.strictEqual(
            findWorkflowForPackage(workflows, repoRoot, '/workspace/jilatax/packages/create-jilatax')?.tagPattern,
            'create-jilatax-v*'
        );
        assert.strictEqual(
            findWorkflowForPackage(workflows, repoRoot, '/workspace/jilatax/packages/jilatax')?.tagPattern,
            'v*'
        );
    });

    test('does not associate a nested package workflow with the monorepo root', () => {
        const repoRoot = '/workspace/jilatax';
        const workflow = parsePublishWorkflow(
            '/workspace/jilatax/.github/workflows/cli.yml',
            packageWorkflow('packages/cli', 'cli-v*')
        );

        assert.ok(workflow);
        assert.strictEqual(findWorkflowForPackage([workflow], repoRoot, repoRoot), undefined);
    });

    test('keeps individual repository workflows compatible', () => {
        const repoRoot = '/workspace/single-package';
        const workflow = parsePublishWorkflow(
            '/workspace/single-package/.github/workflows/publish.yml',
            `on:
  push:
    tags: ["v*"]
jobs:
  publish:
    steps:
      - run: npm publish --provenance --access public
`
        );

        assert.ok(workflow);
        assert.strictEqual(workflow.workingDirectory, undefined);
        assert.strictEqual(findWorkflowForPackage([workflow], repoRoot, repoRoot), workflow);
    });

    test('creates and reads package-specific tags', () => {
        assert.strictEqual(createTagName('v*', '0.0.4'), 'v0.0.4');
        assert.strictEqual(createTagName('cli-v*', '0.0.4'), 'cli-v0.0.4');
        assert.strictEqual(createTagName('create-jilatax-v*', '0.0.3'), 'create-jilatax-v0.0.3');
        assert.strictEqual(versionFromTag('cli-v*', 'cli-v0.0.4'), '0.0.4');
        assert.strictEqual(versionFromTag('cli-v*', 'v0.0.4'), undefined);
    });
});
