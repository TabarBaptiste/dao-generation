import * as vscode from 'vscode';
import { ConnectionFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { DatabaseConnectionFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';
import { VIEW_TITLES, BUTTON_LABELS, WEBVIEW_TYPES, WEBVIEW_FOLDERS } from '../constants/AppConstants';

export class ConnectionFormPanel extends BaseWebviewPanel {
    private databaseService = new DatabaseService();
    private resolve?: (value: ConnectionFormData | undefined) => void;
    private existingData?: ConnectionFormData;

    constructor(extensionUri: vscode.Uri, existingData?: ConnectionFormData) {
        super(
            extensionUri,
            WEBVIEW_TYPES.CONNECTION_FORM,
            existingData ? VIEW_TITLES.EDIT_CONNECTION : VIEW_TITLES.ADD_CONNECTION,
            WEBVIEW_FOLDERS.CONNECTION_FORM
        );
        this.existingData = existingData;
    }

    public async show(): Promise<ConnectionFormData | undefined> {
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
        }
    }

    private async handleTestConnection(data: any): Promise<void> {
        const connectionData = DatabaseConnectionFactory.createTempConnection(data);

        const result = await ErrorHandler.handleAsync(
            'test connexion base de données',
            () => this.databaseService.testConnection(connectionData),
            false
        );

        const success = result === true;
        this.sendMessage({
            command: 'testConnectionResult',
            success,
            message: success ? 'Connexion réussie !' : 'Connexion échouée. Veuillez vérifier vos identifiants.'
        });
    }

    private async handleLoadDatabases(data: any, isAutoLoad: boolean = false): Promise<void> {
        const connectionData = DatabaseConnectionFactory.createTempConnection(data);

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
}