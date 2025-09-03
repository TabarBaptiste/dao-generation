import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseConnection } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { DaoGeneratorService } from '../services/DaoGeneratorService';

export class TableSelectionPanel {
    private static currentPanel: TableSelectionPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly daoGenerator: DaoGeneratorService;
    
    private constructor(
        panel: vscode.WebviewPanel,
        private readonly connection: DatabaseConnection,
        private readonly database: string,
        private readonly databaseService: DatabaseService,
        private readonly extensionUri: vscode.Uri
    ) {
        this._panel = panel;
        this.daoGenerator = new DaoGeneratorService(databaseService);
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static async createOrShow(
        connection: DatabaseConnection, 
        database: string,
        databaseService: DatabaseService,
        extensionUri: vscode.Uri
    ): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel for this exact same database, update it
        console.log('TableSelectionPanel.currentPanel :', TableSelectionPanel.currentPanel);
        if (TableSelectionPanel.currentPanel && 
            TableSelectionPanel.currentPanel.database === database &&
            TableSelectionPanel.currentPanel.connection.id === connection.id) {
            TableSelectionPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Dispose existing panel if it exists
        if (TableSelectionPanel.currentPanel) {
            TableSelectionPanel.currentPanel.dispose();
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'tableSelection',
            `Tables - ${database}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
            }
        );

        TableSelectionPanel.currentPanel = new TableSelectionPanel(panel, connection, database, databaseService, extensionUri);
    }

    public dispose() {
        TableSelectionPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'ready':
                        await this.sendInitialData();
                        break;
                    case 'generate':
                        await this.handleGenerate(message.selectedTables, message.mode);
                        return;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

    private async sendInitialData() {
        try {
            // Send loading state first
            this._panel.webview.postMessage({ command: 'showLoading' });
            
            // Send page data
            this._panel.webview.postMessage({
                command: 'updateData',
                data: {
                    database: this.database,
                    host: this.connection.host
                }
            });

            // Load and send tables
            const tables = await this.databaseService.getTables(this.connection, this.database);
            this._panel.webview.postMessage({
                command: 'updateTables',
                tables: tables
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'showError',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }

    private async handleGenerate(selectedTables: string[], mode: 'save' | 'overwrite'): Promise<void> {
        try {
            vscode.window.showInformationMessage(`Génération de ${selectedTables.length} DAO en cours...`);
            
            await this.daoGenerator.generateDaoFiles(
                this.connection,
                this.database,
                selectedTables,
                { mode }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur lors de la génération: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        try {
            // Get paths to resources
            const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'table-selection');
            const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
            const cssPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
            const jsPath = vscode.Uri.joinPath(webviewPath, 'script.js');

            // Convert paths to webview URIs
            const cssUri = webview.asWebviewUri(cssPath);
            const jsUri = webview.asWebviewUri(jsPath);

            // Read HTML template
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // Replace placeholders
            return htmlContent
                .replace(/{{cspSource}}/g, webview.cspSource)
                .replace(/{{cssUri}}/g, cssUri.toString())
                .replace(/{{jsUri}}/g, jsUri.toString());
                
        } catch (error) {
            console.error('Error loading webview content:', error);
            return this._getErrorHtml(error instanceof Error ? error.message : 'Erreur inconnue');
        }
    }

    private _getErrorHtml(errorMessage: string): string {
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
                <p>Impossible de charger l'interface de sélection des tables.</p>
                <p><strong>Détail:</strong> ${errorMessage}</p>
            </div>
        </body>
        </html>`;
    }
}
