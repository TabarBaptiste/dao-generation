import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConnectionFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';

export class ConnectionFormPanel {
    private databaseService = new DatabaseService();
    private panel: vscode.WebviewPanel | undefined;

    public async show(existingData?: ConnectionFormData, extensionUri?: vscode.Uri): Promise<ConnectionFormData | undefined> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'connectionForm',
                existingData ? 'Edit Database Connection' : 'Add Database Connection',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: extensionUri ? [vscode.Uri.joinPath(extensionUri, 'src', 'webview')] : []
                }
            );

            this.panel.webview.html = this.getWebviewContent(existingData, extensionUri);

            // Handle messages from the webview
            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'ready':
                        // Send initial data to webview
                        this.panel?.webview.postMessage({
                            command: 'loadData',
                            data: existingData,
                            isEdit: !!existingData
                        });
                        break;
                    case 'submit':
                        resolve(message.data);
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        resolve(undefined);
                        this.panel?.dispose();
                        break;
                    case 'testConnection':
                        await this.handleTestConnection(message.data);
                        break;
                    case 'loadDatabases':
                        await this.handleLoadDatabases(message.data);
                        break;
                }
            });

            this.panel.onDidDispose(() => {
                resolve(undefined);
            });
        });
    }

    private async handleTestConnection(data: any): Promise<void> {
        try {
            const connectionData = {
                id: 'temp',
                name: data.name,
                host: data.host,
                port: parseInt(data.port),
                username: data.username,
                password: data.password,
                database: data.database,
                type: data.type as 'mysql' | 'mariadb'
            };

            const success = await this.databaseService.testConnection(connectionData);
            
            this.panel?.webview.postMessage({
                command: 'testConnectionResult',
                success,
                message: success ? 'Connection successful!' : 'Connection failed. Please check your credentials.'
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'testConnectionResult',
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleLoadDatabases(data: any): Promise<void> {
        try {
            const connectionData = {
                id: 'temp',
                name: data.name,
                host: data.host,
                port: parseInt(data.port),
                username: data.username,
                password: data.password,
                type: data.type as 'mysql' | 'mariadb'
            };

            const databases = await this.databaseService.getDatabases(connectionData);
            
            this.panel?.webview.postMessage({
                command: 'databasesLoaded',
                databases
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'databasesLoaded',
                databases: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private getWebviewContent(existingData?: ConnectionFormData, extensionUri?: vscode.Uri): string {
        if (!extensionUri) {
            return this.getErrorHtml('Extension URI not provided');
        }

        try {
            // Get paths to resources
            const webviewPath = vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'connection-form');
            const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
            const cssPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
            const jsPath = vscode.Uri.joinPath(webviewPath, 'script.js');

            // Convert paths to webview URIs
            const cssUri = this.panel!.webview.asWebviewUri(cssPath);
            const jsUri = this.panel!.webview.asWebviewUri(jsPath);

            // Read HTML template
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // Replace placeholders
            return htmlContent
                .replace(/{{cspSource}}/g, this.panel!.webview.cspSource)
                .replace(/{{cssUri}}/g, cssUri.toString())
                .replace(/{{jsUri}}/g, jsUri.toString());
                
        } catch (error) {
            console.error('Error loading webview content:', error);
            return this.getErrorHtml(error instanceof Error ? error.message : 'Erreur inconnue');
        }
    }

    private getErrorHtml(errorMessage: string): string {
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
                <p>Impossible de charger le formulaire de connexion.</p>
                <p><strong>Détail:</strong> ${errorMessage}</p>
            </div>
        </body>
        </html>`;
    }
}