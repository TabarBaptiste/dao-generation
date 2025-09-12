import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Classe de base abstraite pour les panneaux webview
 * Élimine la duplication de la logique de configuration et de chargement du contenu webview
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
     * Crée et affiche le panneau webview
     * @param column Colonne de vue dans laquelle afficher le panneau
     * @returns Promise qui se résout quand le panneau est prêt
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

        // Définir l'icône du panneau
        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.extensionUri, 'assets', 'img', 'logo.png'),
            dark: vscode.Uri.joinPath(this.extensionUri, 'assets', 'img', 'logo.png')
        };

        // Configurer le contenu webview
        this.panel.webview.html = await this.loadWebviewContent();

        // Configurer la gestion des messages
        this.setupMessageHandling();

        // Configurer la disposition
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Méthode abstraite à implémenter par les sous-classes
     * @returns Le nom du dossier webview (ex: 'connection-form', 'table-selection')
     */
    protected abstract getWebviewFolderName(): string;

    /**
     * Méthode abstraite pour gérer les messages webview
     * @param message Message reçu du webview
     */
    protected abstract handleMessage(message: any): Promise<void>;

    /**
     * Charge le contenu webview depuis le modèle HTML
     * @returns Contenu HTML pour le webview
     */
    private async loadWebviewContent(): Promise<string> {
        const webviewFolderName = this.getWebviewFolderName();

        return ErrorHandler.handleSync(
            'charger contenu webview',
            () => this.getWebviewHtml(webviewFolderName),
            false
        ) || this.getErrorHtml('Échec du chargement du contenu webview');
    }

    /**
     * Génère le contenu HTML pour le webview
     * @param webviewFolderName Nom du dossier webview
     * @returns Contenu HTML avec les URIs de ressources remplacées
     */
    private getWebviewHtml(webviewFolderName: string): string {
        if (!this.panel) {
            throw new Error('Panneau non initialisé');
        }

        // Obtenir les chemins vers les ressources
        const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', webviewFolderName);
        const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
        const cssPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
        const jsPath = vscode.Uri.joinPath(webviewPath, 'script.js');

        // Convertir les chemins en URIs webview
        const cssUri = this.panel.webview.asWebviewUri(cssPath);
        const jsUri = this.panel.webview.asWebviewUri(jsPath);

        // Lire le modèle HTML
        const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Remplacer les marqueurs de position
        return htmlContent
            .replace(/{{cspSource}}/g, this.panel.webview.cspSource)
            .replace(/{{cssUri}}/g, cssUri.toString())
            .replace(/{{jsUri}}/g, jsUri.toString());
    }

    /**
     * Génère le HTML d'erreur quand le contenu webview ne parvient pas à se charger
     * @param errorMessage Message d'erreur à afficher
     * @returns Contenu HTML d'erreur
     */
    protected getErrorHtml(errorMessage: string): string {
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
                <p>Impossible de charger l'interface.</p>
                <p><strong>Détail:</strong> ${errorMessage}</p>
            </div>
        </body>
        </html>`;
    }

    /**
     * Configure la gestion des messages pour le webview
     */
    private setupMessageHandling(): void {
        if (!this.panel) {
            return;
        }

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await ErrorHandler.handleAsync(
                    'gérer message webview',
                    () => this.handleMessage(message),
                    false
                );
            },
            null,
            this.disposables
        );
    }

    /**
     * Envoie un message au webview
     * @param message Message à envoyer
     */
    protected sendMessage(message: any): void {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Révèle le panneau s'il existe
     * @param column Colonne de vue optionnelle
     */
    public reveal(column?: vscode.ViewColumn): void {
        this.panel?.reveal(column);
    }

    /**
     * Dispose le panneau et nettoie les ressources
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