import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Abstract base class for webview panels
 * Eliminates duplication of webview setup and content loading logic
 */
export abstract class BaseWebviewPanel {
    protected panel: vscode.WebviewPanel | undefined;
    protected disposables: vscode.Disposable[] = [];

    constructor(
        protected extensionUri: vscode.Uri,
        protected webviewType: string,
        protected title: string
    ) { }

    /**
     * Creates and shows the webview panel
     * @param column View column to show panel in
     * @returns Promise resolving when panel is ready
     */
    protected async createPanel(column?: vscode.ViewColumn): Promise<void> {
        this.panel = vscode.window.createWebviewPanel(
            this.webviewType,
            this.title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'src', 'webview')]
            }
        );

        // Set panel icon
        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.extensionUri, 'assets', 'img', 'logo.png'),
            dark: vscode.Uri.joinPath(this.extensionUri, 'assets', 'img', 'logo.png')
        };

        // Setup webview content
        this.panel.webview.html = await this.loadWebviewContent();

        // Setup message handling
        this.setupMessageHandling();

        // Setup disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Abstract method to be implemented by subclasses
     * @returns The webview folder name (e.g., 'connection-form', 'table-selection')
     */
    protected abstract getWebviewFolderName(): string;

    /**
     * Abstract method for handling webview messages
     * @param message Message received from webview
     */
    protected abstract handleMessage(message: any): Promise<void>;

    /**
     * Loads webview content from HTML template
     * @returns HTML content for webview
     */
    private async loadWebviewContent(): Promise<string> {
        const webviewFolderName = this.getWebviewFolderName();
        
        return ErrorHandler.handleSync(
            'load webview content',
            () => this.getWebviewHtml(webviewFolderName),
            false
        ) || this.getErrorHtml('Failed to load webview content');
    }

    /**
     * Generates HTML content for webview
     * @param webviewFolderName Name of the webview folder
     * @returns HTML content with resource URIs replaced
     */
    private getWebviewHtml(webviewFolderName: string): string {
        if (!this.panel) {
            throw new Error('Panel not initialized');
        }

        // Get paths to resources
        const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', webviewFolderName);
        const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
        const cssPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
        const jsPath = vscode.Uri.joinPath(webviewPath, 'script.js');

        // Convert paths to webview URIs
        const cssUri = this.panel.webview.asWebviewUri(cssPath);
        const jsUri = this.panel.webview.asWebviewUri(jsPath);

        // Read HTML template
        const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Replace placeholders
        return htmlContent
            .replace(/{{cspSource}}/g, this.panel.webview.cspSource)
            .replace(/{{cssUri}}/g, cssUri.toString())
            .replace(/{{jsUri}}/g, jsUri.toString());
    }

    /**
     * Generates error HTML when webview content fails to load
     * @param errorMessage Error message to display
     * @returns Error HTML content
     */
    protected getErrorHtml(errorMessage: string): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    padding: 15px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>Erreur</h2>
                <p>Impossible de charger l'interface.</p>
                <p><strong>Détail:</strong> ${errorMessage}</p>
            </div>
        </body>
        </html>`;
    }

    /**
     * Sets up message handling for webview
     */
    private setupMessageHandling(): void {
        if (!this.panel) {
            return;
        }

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await ErrorHandler.handleAsync(
                    'handle webview message',
                    () => this.handleMessage(message),
                    false
                );
            },
            null,
            this.disposables
        );
    }

    /**
     * Sends message to webview
     * @param message Message to send
     */
    protected sendMessage(message: any): void {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Reveals the panel if it exists
     * @param column Optional view column
     */
    public reveal(column?: vscode.ViewColumn): void {
        this.panel?.reveal(column);
    }

    /**
     * Disposes the panel and cleans up resources
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}