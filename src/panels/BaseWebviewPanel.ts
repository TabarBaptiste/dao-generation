import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Classe de base abstraite pour tous les panneaux webview de l'extension.
 * Cette classe centralise la logique commune de création, configuration et gestion des webviews,
 * éliminant la duplication de code et garantissant une approche cohérente pour tous les panneaux.
 * 
 * @class BaseWebviewPanel
 */
export abstract class BaseWebviewPanel {
    protected panel: vscode.WebviewPanel | undefined;
    protected disposables: vscode.Disposable[] = [];

    constructor(
        protected extensionUri: vscode.Uri,
        protected webviewType: string,
        protected title: string,
        protected webviewFolderName: string
    ) { }

    /**
     * Crée et configure un nouveau panneau webview avec tous les paramètres nécessaires.
     * Cette méthode initialise le panneau avec les permissions appropriées, configure les chemins des ressources,
     * charge le contenu HTML et configure la gestion des messages et des événements de disposition.
     *
     * @protected
     * @param {vscode.ViewColumn} [column] Colonne de vue dans laquelle afficher le panneau. Si non spécifiée, utilise ViewColumn.One par défaut
     * @return {Promise<void>} Promise qui se résout quand le panneau est entièrement configuré et prêt à être utilisé
     * @memberof BaseWebviewPanel
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
     * Méthode abstraite que chaque classe dérivée doit implémenter pour traiter les messages.
     * Cette méthode est appelée automatiquement chaque fois qu'un message est reçu du webview,
     * permettant à chaque panneau de définir sa propre logique de traitement des interactions utilisateur.
     * 
     * @protected
     * @abstract
     * @param {*} message Objet message reçu du webview contenant au minimum une propriété 'command' et optionnellement des données associées
     * @return {Promise<void>} Promise qui se résout une fois le message traité, permettant la gestion d'opérations asynchrones
     * @memberof BaseWebviewPanel
     */
    protected abstract handleMessage(message: any): Promise<void>;

    /**
     * Charge le contenu webview depuis le fichier HTML du modèle.
     * Cette méthode utilise le gestionnaire d'erreurs pour capturer et traiter les échecs de chargement,
     * retournant un contenu d'erreur alternatif si le chargement principal échoue.
     *
     * @private
     * @return {Promise<string>} Promise contenant le contenu HTML complet du webview avec toutes les substitutions effectuées, ou une page d'erreur en cas d'échec
     * @memberof BaseWebviewPanel
     */
    private async loadWebviewContent(): Promise<string> {
        return ErrorHandler.handleSync(
            'charger contenu webview',
            () => this.getWebviewHtml(this.webviewFolderName),
            false
        ) || this.getErrorHtml('Échec du chargement du contenu webview');
    }

    /**
     * Génère le contenu HTML final pour le webview en remplaçant les marqueurs de position.
     * Cette méthode lit le fichier HTML du modèle, convertit les chemins des ressources en URIs webview sécurisées,
     * et remplace tous les marqueurs de position avec les valeurs appropriées pour le contexte VS Code.
     *
     * @private
     * @param {string} webviewFolderName Nom du dossier contenant les ressources webview (HTML, CSS, JS) dans src/webview/
     * @return {string} Contenu HTML complet avec tous les URIs de ressources remplacés par leurs équivalents webview sécurisés
     * @throws {Error} Lance une erreur si le panneau n'est pas initialisé ou si les fichiers de ressources sont introuvables
     * @memberof BaseWebviewPanel
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
     * Génère une page HTML d'erreur stylée quand le contenu webview principal ne peut pas être chargé.
     * Cette méthode crée une interface utilisateur cohérente avec le thème VS Code pour afficher
     * les erreurs de manière professionnelle et informative.
     *
     * @protected
     * @param {string} errorMessage Message d'erreur détaillé à afficher à l'utilisateur expliquant la nature du problème
     * @return {string} Contenu HTML complet d'une page d'erreur stylée avec les couleurs et polices du thème VS Code actuel
     * @memberof BaseWebviewPanel
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
     * Configure le système de gestion des messages bidirectionnel entre le webview et l'extension.
     * Cette méthode établit l'écoute des messages envoyés depuis le JavaScript du webview et
     * les transfère vers la méthode handleMessage avec gestion d'erreurs appropriée.
     *
     * @private
     * @return {void} Ne retourne rien, mais configure les écouteurs d'événements pour la communication webview
     * @memberof BaseWebviewPanel
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
     * Envoie un message vers le webview pour communication avec le JavaScript côté client.
     * Cette méthode permet à l'extension d'envoyer des données, des commandes ou des notifications
     * vers l'interface utilisateur du webview de manière asynchrone et sécurisée.
     *
     * @protected
     * @param {*} message Objet message à envoyer, généralement structuré avec une propriété 'command' et des données associées
     * @return {void} Ne retourne rien, l'envoi du message est asynchrone et ne garantit pas la réception
     * @memberof BaseWebviewPanel
     */
    protected sendMessage(message: any): void {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Révèle et met en avant le panneau webview s'il existe déjà.
     * Cette méthode permet de ramener un panneau existant au premier plan plutôt que d'en créer un nouveau,
     * optimisant ainsi l'utilisation des ressources et l'expérience utilisateur.
     *
     * @param {vscode.ViewColumn} [column] Colonne de vue optionnelle dans laquelle révéler le panneau. Si non spécifiée, utilise la colonne actuelle
     * @return {void} Ne retourne rien, l'action de révélation est immédiate si le panneau existe
     * @memberof BaseWebviewPanel
     */
    public reveal(column?: vscode.ViewColumn): void {
        this.panel?.reveal(column);
    }

    /**
     * Dispose le panneau et nettoie toutes les ressources associées pour éviter les fuites mémoire.
     * Cette méthode ferme proprement le panneau webview, libère tous les écouteurs d'événements
     * et s'assure qu'aucune référence circulaire ne subsiste.
     *
     * @return {void} Ne retourne rien, mais garantit la libération complète des ressources
     * @memberof BaseWebviewPanel
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