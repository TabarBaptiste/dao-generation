import * as vscode from 'vscode';
import { ServeurFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { DatabaseServeurFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';
import { VIEW_TITLES, BUTTON_LABELS, WEBVIEW_TYPES, WEBVIEW_FOLDERS, DEFAULT_PATHS } from '../constants/AppConstants';

/**
 * Panneau webview pour la gestion des formulaires de connexion aux serveurs de base de données.
 * Cette classe hérite de BaseWebviewPanel et fournit une interface utilisateur complète pour
 * créer, modifier et tester les connexions aux bases de données avec validation en temps réel.
 *
 * @export
 * @class ServeurFormPanel
 * @extends {BaseWebviewPanel}
 */
export class ServeurFormPanel extends BaseWebviewPanel {
    private databaseService = new DatabaseService();
    private resolve?: (value: ServeurFormData | undefined) => void;
    private existingData?: ServeurFormData;

    constructor(extensionUri: vscode.Uri, existingData?: ServeurFormData) {
        super(
            extensionUri,
            WEBVIEW_TYPES.CONNECTION_FORM,
            existingData ? VIEW_TITLES.EDIT_CONNECTION : VIEW_TITLES.ADD_CONNECTION,
            WEBVIEW_FOLDERS.CONNECTION_FORM
        );
        this.existingData = existingData;
    }

    /**
     * Affiche le formulaire de connexion et retourne les données saisies par l'utilisateur.
     * Cette méthode crée le panneau webview de manière asynchrone et attend que l'utilisateur
     * soumette le formulaire ou l'annule, retournant les données appropriées.
     *
     * @return {Promise<ServeurFormData | undefined>} Promise qui se résout avec les données du formulaire si validées et soumises, ou undefined si annulé
     * @memberof ServeurFormPanel
     */
    public async show(): Promise<ServeurFormData | undefined> {
        return new Promise(async (resolve) => {
            this.resolve = resolve;
            await this.createPanel();
        });
    }

    /**
     * Traite les messages reçus du webview et exécute les actions correspondantes.
     * Cette méthode gère toutes les interactions utilisateur du formulaire incluant la soumission,
     * l'annulation, les tests de connexion, le chargement des bases de données et la sélection de chemins.
     *
     * @protected
     * @param {*} message - Objet message contenant la commande et les données associées provenant du webview
     * @return {Promise<void>} Promise qui se résout une fois l'action du message traitée complètement
     * @memberof ServeurFormPanel
     */
    protected async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'ready':
                // Envoyer les données initiales au webview
                this.sendMessage({
                    command: 'loadData',
                    data: this.existingData,
                    isEdit: !!this.existingData,
                    titles: {
                        add: VIEW_TITLES.ADD_CONNECTION,
                        edit: VIEW_TITLES.EDIT_CONNECTION
                    },
                    buttonLabels: {
                        create: BUTTON_LABELS.CREATE,
                        update: BUTTON_LABELS.UPDATE
                    }
                });
                break;
            case 'submit':
                this.resolve?.(message.data);
                this.dispose();
                break;
            case 'cancel':
                this.resolve?.(undefined);
                this.dispose();
                break;
            case 'testConnection':
                await this.handleTestConnection(message.data);
                break;
            case 'loadDatabases':
                await this.handleLoadDatabases(message.data, message.isAutoLoad || false);
                break;
            case 'selectPath':
                await this.handleSelectPath();
                break;
        }
    }

    /**
     * Gère le test de connexion à la base de données avec les paramètres fournis.
     * Cette méthode valide la connectivité en temps réel sans sauvegarder la configuration,
     * permettant à l'utilisateur de vérifier ses paramètres avant la soumission finale.
     *
     * @private
     * @param {*} data - Données de connexion à tester contenant host, port, username, password, etc.
     * @return {Promise<void>} Promise qui se résout après avoir envoyé le résultat du test au webview
     * @memberof ServeurFormPanel
     */
    private async handleTestConnection(data: any): Promise<void> {
        try {
            const connectionData = DatabaseServeurFactory.createTempServeur(data);
            const result = await this.databaseService.testConnection(connectionData);

            this.sendMessage({
                command: 'testConnectionResult',
                success: result.success,
                message: result.message
            });
        } catch (error) {
            ErrorHandler.logError('handleTestConnection', error);
            this.sendMessage({
                command: 'testConnectionResult',
                success: false,
                message: 'Erreur inattendue lors du test de connexion.'
            });
        }
    }

    /**
     * Charge la liste des bases de données disponibles sur le serveur spécifié.
     * Cette méthode peut être déclenchée automatiquement (après un test de connexion réussi)
     * ou manuellement (par action utilisateur), et gère différents messages selon le contexte.
     *
     * @private
     * @param {*} data - Données de connexion utilisées pour se connecter au serveur et récupérer les bases
     * @param {boolean} [isAutoLoad=false] - Indique si le chargement est automatique (true) ou manuel (false), affectant les messages affichés
     * @return {Promise<void>} Promise qui se résout après avoir envoyé la liste des bases de données ou un message d'erreur au webview
     * @memberof ServeurFormPanel
     */
    private async handleLoadDatabases(data: any, isAutoLoad: boolean = false): Promise<void> {
        const connectionData = DatabaseServeurFactory.createTempServeur(data);

        const databases = await ErrorHandler.handleAsync(
            'charger bases de données',
            () => this.databaseService.getDatabases(connectionData),
            false
        );

        const success = databases !== undefined && Array.isArray(databases);

        if (success) {
            // Succès : afficher le message de chargement approprié
            const message = isAutoLoad
                ? `${databases.length} base(s) de données chargée(s) automatiquement`
                : `${databases.length} base(s) de données chargée(s)`;

            this.sendMessage({
                command: 'databasesLoaded',
                databases: databases || [],
                success: true,
                message,
                isAutoLoad
            });
        } else {
            // Échec : message différent selon le contexte
            const message = isAutoLoad
                ? 'Connexion échouée. Veuillez vérifier vos identifiants.'
                : 'Échec du chargement des bases de données';

            this.sendMessage({
                command: 'databasesLoaded',
                databases: [],
                success: false,
                message,
                isAutoLoad
            });
        }
    }

    /**
     * Ouvre une boîte de dialogue pour permettre à l'utilisateur de sélectionner un répertoire.
     * Cette méthode facilite la sélection du chemin de destination pour la génération des fichiers DAO,
     * en proposant par défaut le répertoire WAMP www comme point de départ.
     *
     * @private
     * @return {Promise<void>} Promise qui se résout après avoir envoyé le chemin sélectionné au webview, ou ne rien envoyer si annulé
     * @memberof ServeurFormPanel
     */
    private async handleSelectPath(): Promise<void> {
        const result = await ErrorHandler.handleAsync(
            'sélection du répertoire',
            async () => {
                return await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Sélectionner le répertoire du projet',
                    title: 'Choisir le répertoire du projet pour la génération des DAO',
                    defaultUri: vscode.Uri.file(DEFAULT_PATHS.WAMP_WWW)
                });
            },
            true
        );

        if (result && result[0]) {
            this.sendMessage({
                command: 'pathSelected',
                path: result[0].fsPath
            });
        }
    }
}