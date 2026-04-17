import * as vscode from "vscode";
import * as Config from "./config";
import { Settings } from "./config";
import { Icons } from "../ui/icons";

export async function createUnfoldedDecorationType(): Promise<vscode.TextEditorDecorationType> {
    return vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        opacity: Config.get<number>(Settings.UnfoldedTextOpacity, 1).toString(),
    });
}

export async function createFoldedDecorationType(): Promise<vscode.TextEditorDecorationType> {
    const showImage = Config.get<boolean>(Settings.ShowTailwindImage, true);
    let iconPath: vscode.Uri | undefined;
    
    if (showImage) {
        iconPath = await Icons.generateScaledSVGDataURI();
    }

    return vscode.window.createTextEditorDecorationType({
        before: {
            contentIconPath: iconPath,
            backgroundColor: Config.get<string>(Settings.FoldedTextBackgroundColor, "transparent"),
            margin: "0 0 0 -5px",
        },
        after: {
            contentText: Config.get<string>(Settings.FoldedText, "..."), // Changed from "class" to "..."
            backgroundColor: Config.get<string>(Settings.FoldedTextBackgroundColor, "rgba(100, 150, 255, 0.15)"), // A subtle soft background
            color: Config.get<string>(Settings.FoldedTextColor, "#7cdbfe"),
            margin: "0 0 0 2px", // Tiny space from the icon
        },
        textDecoration: "none; display: none;",
        backgroundColor: "rgba(100, 150, 255, 0.05)", // Optional overall wrap
        borderRadius: "4px", // Rounded corners as per request
    });
}
