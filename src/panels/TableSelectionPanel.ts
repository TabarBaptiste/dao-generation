import * as vscode from 'vscode';
import * as fs from 'fs';
import { DatabaseServeur } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { DaoGeneratorService } from '../services/DaoGeneratorService';

export class TableSelectionPanel {
    private static currentPanel: TableSelectionPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly daoGenerator: DaoGeneratorService;

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly serveurs: DatabaseServeur,
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
        serveurs: DatabaseServeur,
        database: string,
        databaseService: DatabaseService,
        extensionUri: vscode.Uri
    ): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Si nous avons déjà un panneau pour cette même base de données, le mettre à jour
        if (TableSelectionPanel.currentPanel &&
            TableSelectionPanel.currentPanel.database === database &&
            TableSelectionPanel.currentPanel.serveurs.id === serveurs.id) {
            TableSelectionPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Supprimer le panneau existant s'il existe
        if (TableSelectionPanel.currentPanel) {
            TableSelectionPanel.currentPanel.dispose();
        }

        // Créer un nouveau panneau
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

        // Ajouter une icône au panneau en utilisant les icônes intégrées
        panel.iconPath = {
            light: vscode.Uri.joinPath(extensionUri, 'assets', 'img', 'logo.png'),
            dark: vscode.Uri.joinPath(extensionUri, 'assets', 'img', 'logo.png')
        };

        TableSelectionPanel.currentPanel = new TableSelectionPanel(panel, serveurs, database, databaseService, extensionUri);
    }

    public dispose() {
        TableSelectionPanel.currentPanel = undefined;

        // Nettoyer nos ressources
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
            // Envoyer d'abord l'état de chargement
            this._panel.webview.postMessage({ command: 'showLoading' });

            // Envoyer les données de la page
            this._panel.webview.postMessage({
                command: 'updateData',
                data: {
                    database: this.database,
                    host: this.serveurs.host
                }
            });

            // Charger et envoyer les tables
            const tables = await this.databaseService.getTables(this.serveurs, this.database);
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
                this.serveurs,
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
            // Obtenir les chemins vers les ressources
            const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'table-selection');
            const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
            const cssPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
            const jsPath = vscode.Uri.joinPath(webviewPath, 'script.js');

            // Convertir les chemins en URIs webview
            const cssUri = webview.asWebviewUri(cssPath);
            const jsUri = webview.asWebviewUri(jsPath);

            // Lire le template HTML
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // Remplacer les placeholders
            return htmlContent
                .replace(/{{cspSource}}/g, webview.cspSource)
                .replace(/{{cssUri}}/g, cssUri.toString())
                .replace(/{{jsUri}}/g, jsUri.toString());

        } catch (error) {
            console.error('Erreur lors du chargement du contenu webview :', error);
            return this._getErrorHtml(error instanceof Error ? error.message : 'Erreur inconnue');
        }
    }

    private _getErrorHtml(errorMessage: string): string {
        return `<!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Erreur</title>
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
