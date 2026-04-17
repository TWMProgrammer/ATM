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

    const defaultBg = "rgba(50, 150, 255, 0.15)"; // Soft blueish background across the pill
    const bgColor = Config.get<string>(Settings.FoldedTextBackgroundColor, defaultBg);

    return vscode.window.createTextEditorDecorationType({
        before: {
            contentIconPath: iconPath,
            backgroundColor: bgColor,
            margin: "0", // Removed negative margin to keep pill continuous
            textDecoration: "none; padding: 1px 2px 1px 6px; border-radius: 6px 0 0 6px;", // Left side inner padding and rounded border
        },
        after: {
            contentText: Config.get<string>(Settings.FoldedText, "..."),
            backgroundColor: bgColor, // Connect background over the text
            color: Config.get<string>(Settings.FoldedTextColor, "#7cdbfe"),
            margin: "0", // Remove margin to connect smoothly to 'before'
            textDecoration: "none; padding: 1px 6px 1px 2px; border-radius: 0 6px 6px 0;", // Right side inner padding and rounded border
        },
        textDecoration: "none; display: none;",
        // Removed global backgroundColor and borderRadius to focus solely on the joined before & after pill
    });
}
