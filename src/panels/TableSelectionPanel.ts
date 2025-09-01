import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';

export class TableSelectionPanel {
    private static currentPanel: TableSelectionPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    
    private constructor(
        panel: vscode.WebviewPanel,
        private readonly connection: DatabaseConnection,
        private readonly database: string,
        private readonly databaseService: DatabaseService
    ) {
        this._panel = panel;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static async createOrShow(
        connection: DatabaseConnection, 
        database: string,
        databaseService: DatabaseService
    ): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (TableSelectionPanel.currentPanel) {
            TableSelectionPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'tableSelection',
            `Tables - ${database}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        TableSelectionPanel.currentPanel = new TableSelectionPanel(panel, connection, database, databaseService);
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
            message => {
                switch (message.command) {
                    case 'generate':
                        vscode.window.showInformationMessage(`Génération DAO demandée pour ${message.selectedTables.length} table(s) (fonctionnalité à implémenter)`);
                        return;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        try {
            const tables = await this.databaseService.getTables(this.connection, this.database);
            
            const tableCheckboxes = tables.map(table => `
                <div class="table-item">
                    <label>
                        <input type="checkbox" value="${table}" checked> ${table}
                    </label>
                </div>
            `).join('');

            return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Table Selection</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    
                    .header {
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    
                    .header h1 {
                        margin: 0;
                        font-size: 1.5em;
                        font-weight: normal;
                    }
                    
                    .header .subtitle {
                        color: var(--vscode-descriptionForeground);
                        margin-top: 5px;
                    }
                    
                    .tables-section {
                        margin-bottom: 30px;
                    }
                    
                    .section-title {
                        font-weight: 600;
                        margin-bottom: 15px;
                        color: var(--vscode-foreground);
                    }
                    
                    .table-controls {
                        margin-bottom: 15px;
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }
                    
                    .table-list {
                        max-height: 400px;
                        overflow-y: auto;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        padding: 10px;
                        background-color: var(--vscode-input-background);
                    }
                    
                    .table-item {
                        margin: 8px 0;
                        padding: 4px;
                    }
                    
                    .table-item label {
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        padding: 2px 4px;
                        border-radius: 2px;
                    }
                    
                    .table-item label:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .table-item input[type="checkbox"] {
                        margin-right: 8px;
                    }
                    
                    .options-section {
                        margin-bottom: 30px;
                        padding: 15px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        background-color: var(--vscode-input-background);
                    }
                    
                    .radio-group {
                        display: flex;
                        gap: 20px;
                        margin-top: 10px;
                    }
                    
                    .radio-item label {
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                    }
                    
                    .radio-item input[type="radio"] {
                        margin-right: 8px;
                    }
                    
                    .actions {
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }
                    
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 2px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    button:disabled {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        cursor: not-allowed;
                    }
                    
                    .secondary-btn {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    .secondary-btn:hover:not(:disabled) {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .selected-count {
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Génération DAO</h1>
                    <div class="subtitle">Base de données: <strong>${this.database}</strong> sur ${this.connection.host}</div>
                </div>
                
                <div class="tables-section">
                    <div class="section-title">Sélection des tables</div>
                    <div class="table-controls">
                        <button type="button" class="secondary-btn" onclick="selectAll()">Tout sélectionner</button>
                        <button type="button" class="secondary-btn" onclick="selectNone()">Tout déselectionner</button>
                        <span class="selected-count" id="selectedCount">${tables.length} table(s) sélectionnée(s)</span>
                    </div>
                    <div class="table-list">
                        ${tableCheckboxes}
                    </div>
                </div>
                
                <div class="options-section">
                    <div class="section-title">Options de génération</div>
                    <div class="radio-group">
                        <div class="radio-item">
                            <label>
                                <input type="radio" name="mode" value="save" checked> Sauvegarder
                            </label>
                        </div>
                        <div class="radio-item">
                            <label>
                                <input type="radio" name="mode" value="overwrite"> Écraser
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="actions">
                    <button type="button" onclick="generateDao()" id="generateBtn">
                        Générer DAO
                    </button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function updateSelectedCount() {
                        const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
                        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                        document.getElementById('selectedCount').textContent = selectedCount + ' table(s) sélectionnée(s)';
                        
                        const generateBtn = document.getElementById('generateBtn');
                        generateBtn.disabled = selectedCount === 0;
                    }
                    
                    function selectAll() {
                        const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
                        checkboxes.forEach(cb => cb.checked = true);
                        updateSelectedCount();
                    }
                    
                    function selectNone() {
                        const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
                        checkboxes.forEach(cb => cb.checked = false);
                        updateSelectedCount();
                    }
                    
                    function generateDao() {
                        const selectedTables = Array.from(document.querySelectorAll('.table-item input[type="checkbox"]:checked'))
                            .map(cb => cb.value);
                        const mode = document.querySelector('input[name="mode"]:checked').value;
                        
                        vscode.postMessage({
                            command: 'generate',
                            selectedTables: selectedTables,
                            mode: mode
                        });
                    }
                    
                    // Add event listeners
                    document.addEventListener('DOMContentLoaded', function() {
                        const checkboxes = document.querySelectorAll('.table-item input[type="checkbox"]');
                        checkboxes.forEach(cb => {
                            cb.addEventListener('change', updateSelectedCount);
                        });
                        
                        updateSelectedCount();
                    });
                </script>
            </body>
            </html>`;
        } catch (error) {
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
                    <p>Impossible de récupérer les tables de la base de données "${this.database}".</p>
                    <p><strong>Détail:</strong> ${error instanceof Error ? error.message : 'Erreur inconnue'}</p>
                </div>
            </body>
            </html>`;
        }
    }
}
