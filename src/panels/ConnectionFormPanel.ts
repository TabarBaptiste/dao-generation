import * as vscode from 'vscode';
import { ServeurFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { DatabaseServeurFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';
import { VIEW_TITLES, BUTTON_LABELS, WEBVIEW_TYPES, WEBVIEW_FOLDERS, DEFAULT_PATHS } from '../constants/AppConstants';

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

    public async show(): Promise<ServeurFormData | undefined> {
        return new Promise(async (resolve) => {
            this.resolve = resolve;
            await this.createPanel();
        });
    }

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