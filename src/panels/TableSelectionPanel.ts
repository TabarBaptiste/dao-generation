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

    /**
     * Crée ou révèle un panneau de sélection de tables pour une base de données spécifique.
     * Cette méthode implémente un pattern singleton par base de données, évitant la duplication
     * de panneaux pour la même source de données et optimisant l'utilisation des ressources.
     *
     * @static
     * @param {DatabaseServeur} serveurs - Configuration du serveur de base de données contenant les informations de connexion
     * @param {string} database - Nom de la base de données dont on veut afficher les tables
     * @param {DatabaseService} databaseService - Service pour les opérations de base de données (connexion, requêtes)
     * @param {vscode.Uri} extensionUri - URI de l'extension pour localiser les ressources webview
     * @return {Promise<void>} Promise qui se résout une fois le panneau créé, configuré et affiché
     * @memberof TableSelectionPanel
     */
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

    /**
     * Dispose proprement le panneau et libère toutes les ressources associées.
     * Cette méthode nettoie la référence statique, ferme le panneau webview et dispose
     * tous les écouteurs d'événements pour éviter les fuites mémoire.
     *
     * @return {void} Ne retourne rien, mais garantit la libération complète des ressources
     * @memberof TableSelectionPanel
     */
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

    /**
     * Configure et initialise le panneau webview avec le contenu HTML et la gestion des messages.
     * Cette méthode privée établit la communication bidirectionnelle avec le webview,
     * configure les écouteurs d'événements et charge le contenu initial de l'interface.
     *
     * @private
     * @return {Promise<void>} Promise qui se résout une fois le panneau entièrement configuré et prêt
     * @memberof TableSelectionPanel
     */
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

    /**
     * Envoie les données initiales au webview une fois celui-ci prêt à les recevoir.
     * Cette méthode charge les informations de la base de données, affiche un état de chargement,
     * puis récupère et transmet la liste complète des tables disponibles.
     *
     * @private
     * @return {Promise<void>} Promise qui se résout après avoir envoyé toutes les données initiales ou un message d'erreur
     * @memberof TableSelectionPanel
     */
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

    /**
     * Gère la génération des fichiers DAO pour les tables sélectionnées par l'utilisateur.
     * Cette méthode lance le processus de génération avec le mode spécifié (sauvegarde ou écrasement),
     * affiche des notifications de progression et gère les erreurs de génération.
     *
     * @private
     * @param {string[]} selectedTables - Tableau des noms de tables sélectionnées pour la génération des DAO
     * @param {('save' | 'overwrite')} mode - Mode de génération : 'save' pour éviter l'écrasement, 'overwrite' pour remplacer les fichiers existants
     * @return {Promise<void>} Promise qui se résout une fois la génération terminée ou en cas d'erreur
     * @memberof TableSelectionPanel
     */
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

    /**
     * Génère et retourne le contenu HTML complet du webview avec toutes les ressources intégrées.
     * Cette méthode lit le template HTML, convertit les chemins des ressources en URIs webview sécurisées,
     * et remplace tous les marqueurs de position avec les valeurs appropriées.
     *
     * @private
     * @param {vscode.Webview} webview - Instance webview utilisée pour convertir les chemins en URIs sécurisées
     * @return {Promise<string>} Promise contenant le contenu HTML complet du webview ou une page d'erreur en cas d'échec
     * @memberof TableSelectionPanel
     */
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

    /**
     * Génère une page HTML d'erreur stylée pour afficher les erreurs de chargement du webview.
     * Cette méthode crée une interface d'erreur cohérente avec le thème VS Code,
     * permettant d'informer l'utilisateur des problèmes de manière professionnelle.
     *
     * @private
     * @param {string} errorMessage - Message d'erreur détaillé expliquant la nature du problème rencontré
     * @return {string} Contenu HTML complet d'une page d'erreur stylée avec les couleurs du thème VS Code
     * @memberof TableSelectionPanel
     */
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
