import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateSideBarSettings } from '../settings/native/side-bar/index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

suite('Startup Layout Settings Tests', function () {
    this.timeout(15000);

    let originalLayoutMode: string | undefined;
    let originalSidebarLocation: string | undefined;
    let originalActivityBarLocation: string | undefined;

    suiteSetup(async () => {
        const globalState = vscode.workspace.getConfiguration('workbench') as any;
        originalLayoutMode = globalState.get('atm.layoutMode');

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        originalSidebarLocation = workbenchConfig.get<string>('sideBar.location');
        originalActivityBarLocation = workbenchConfig.get<string>('activityBar.location');
    });

    suiteTeardown(async () => {
        const globalState = vscode.workspace.getConfiguration('workbench') as any;
        if (originalLayoutMode !== undefined) {
            await globalState.update('atm.layoutMode', originalLayoutMode, vscode.ConfigurationTarget.Global);
        }

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        await workbenchConfig.update('sideBar.location', originalSidebarLocation, vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', originalActivityBarLocation, vscode.ConfigurationTarget.Global);
        await sleep(500);
    });

    test('should apply Pro layout when layoutMode is "pro"', async () => {
        const globalState = vscode.workspace.getConfiguration('workbench') as any;
        await globalState.update('atm.layoutMode', 'pro', vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to non-pro layout first
        await workbenchConfig.update('sideBar.location', 'left', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'default', vscode.ConfigurationTarget.Global);
        await sleep(500);

        const context = { globalState: {} as any } as vscode.ExtensionContext;
        await activateSideBarSettings(context);
        await sleep(500);

        const freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'right');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'top');
    });

    test('should apply Normal layout when layoutMode is "normal"', async () => {
        const globalState = vscode.workspace.getConfiguration('workbench') as any;
        await globalState.update('atm.layoutMode', 'normal', vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to pro layout first
        await workbenchConfig.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'top', vscode.ConfigurationTarget.Global);
        await sleep(500);

        const context = { globalState: {} as any } as vscode.ExtensionContext;
        await activateSideBarSettings(context);
        await sleep(500);

        const freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'left');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'default');
    });

    test('should not change layout when layoutMode is undefined (defaults to "pro")', async () => {
        const globalState = vscode.workspace.getConfiguration('workbench') as any;
        await globalState.update('atm.layoutMode', undefined, vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to pro layout first
        await workbenchConfig.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'top', vscode.ConfigurationTarget.Global);
        await sleep(500);

        const context = { globalState: {} as any } as vscode.ExtensionContext;
        await activateSideBarSettings(context);
        await sleep(500);

        let freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'right');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'top');

        // Set to normal layout
        await workbenchConfig.update('sideBar.location', 'left', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'default', vscode.ConfigurationTarget.Global);
        await sleep(500);

        await activateSideBarSettings(context);
        await sleep(500);

        freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'left');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'default');
    });
});
