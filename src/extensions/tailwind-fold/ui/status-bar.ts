import * as vscode from "vscode";

export class StatusBar {
    private static statusBarItem: vscode.StatusBarItem;

    static initialize() {
        if (!this.statusBarItem) {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            this.statusBarItem.command = "tailwind-fold.toggleAutoFold";
        }

        const autoFoldEnabled = vscode.workspace
            .getConfiguration("tailwind-fold")
            .get<boolean>("autoFold", true);

        this.update(autoFoldEnabled);
    }

    static update(isFolded: boolean) {
        if (isFolded) {
            this.statusBarItem.text = "$(fold) Tailwind Fold";
            this.statusBarItem.tooltip = "Tailwind classes are folded. Click to unfold.";
        } else {
            this.statusBarItem.text = "$(unfold) Tailwind Unfold";
            this.statusBarItem.tooltip = "Tailwind classes are unfolded. Click to fold.";
        }
        this.statusBarItem.show();
    }

    static dispose() {
        this.statusBarItem?.dispose();
    }
}
