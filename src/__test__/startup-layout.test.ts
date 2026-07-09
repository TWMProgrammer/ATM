import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateSideBarSettings } from '../settings/native/side-bar/index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

suite('Startup Layout Settings Tests', function () {
    this.timeout(15000);

    let originalStartupMode: string | undefined;
    let originalSidebarLocation: string | undefined;
    let originalActivityBarLocation: string | undefined;

    suiteSetup(async () => {
        const atmConfig = vscode.workspace.getConfiguration('atm.layout');
        originalStartupMode = atmConfig.get<string>('startupMode');

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        originalSidebarLocation = workbenchConfig.get<string>('sideBar.location');
        originalActivityBarLocation = workbenchConfig.get<string>('activityBar.location');
    });

    suiteTeardown(async () => {
        const atmConfig = vscode.workspace.getConfiguration('atm.layout');
        await atmConfig.update('startupMode', originalStartupMode, vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        await workbenchConfig.update('sideBar.location', originalSidebarLocation, vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', originalActivityBarLocation, vscode.ConfigurationTarget.Global);
        await sleep(500);
    });

    test('should apply Pro layout when startupMode is "pro"', async () => {
        const atmConfig = vscode.workspace.getConfiguration('atm.layout');
        await atmConfig.update('startupMode', 'pro', vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to non-pro layout first
        await workbenchConfig.update('sideBar.location', 'left', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'default', vscode.ConfigurationTarget.Global);
        await sleep(500);

        await activateSideBarSettings();
        await sleep(500);

        const freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'right');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'top');
    });

    test('should apply Normal layout when startupMode is "normal"', async () => {
        const atmConfig = vscode.workspace.getConfiguration('atm.layout');
        await atmConfig.update('startupMode', 'normal', vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to pro layout first
        await workbenchConfig.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'top', vscode.ConfigurationTarget.Global);
        await sleep(500);

        await activateSideBarSettings();
        await sleep(500);

        const freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'left');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'default');
    });

    test('should not change layout when startupMode is "none"', async () => {
        const atmConfig = vscode.workspace.getConfiguration('atm.layout');
        await atmConfig.update('startupMode', 'none', vscode.ConfigurationTarget.Global);

        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        // Set to pro layout
        await workbenchConfig.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'top', vscode.ConfigurationTarget.Global);
        await sleep(500);

        await activateSideBarSettings();
        await sleep(500);

        let freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'right');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'top');

        // Set to normal layout
        await workbenchConfig.update('sideBar.location', 'left', vscode.ConfigurationTarget.Global);
        await workbenchConfig.update('activityBar.location', 'default', vscode.ConfigurationTarget.Global);
        await sleep(500);

        await activateSideBarSettings();
        await sleep(500);

        freshWorkbenchConfig = vscode.workspace.getConfiguration('workbench');
        assert.strictEqual(freshWorkbenchConfig.get<string>('sideBar.location'), 'left');
        assert.strictEqual(freshWorkbenchConfig.get<string>('activityBar.location'), 'default');
    });
});
