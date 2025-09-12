import * as vscode from 'vscode';
import { ConnectionFormData } from '../types/Connection';
import { DatabaseService } from '../services/DatabaseService';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { DatabaseConnectionFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';

export class ConnectionFormPanel extends BaseWebviewPanel {
    private databaseService = new DatabaseService();
    private resolve?: (value: ConnectionFormData | undefined) => void;
    private existingData?: ConnectionFormData;

    constructor(extensionUri: vscode.Uri, existingData?: ConnectionFormData) {
        super(
            extensionUri,
            'connectionForm',
            existingData ? 'Edit Database Connection' : 'Add Database Connection'
        );
        this.existingData = existingData;
    }

    protected getWebviewFolderName(): string {
        return 'connection-form';
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
                // Send initial data to webview
                this.sendMessage({
                    command: 'loadData',
                    data: this.existingData,
                    isEdit: !!this.existingData
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
            'test database connection',
            () => this.databaseService.testConnection(connectionData),
            false
        );

        const success = result === true;
        this.sendMessage({
            command: 'testConnectionResult',
            success,
            message: success ? 'Connection successful!' : 'Connection failed. Please check your credentials.'
        });
    }

    private async handleLoadDatabases(data: any, isAutoLoad: boolean = false): Promise<void> {
        const connectionData = DatabaseConnectionFactory.createTempConnection(data);

        const databases = await ErrorHandler.handleAsync(
            'load databases',
            () => this.databaseService.getDatabases(connectionData),
            false
        );

        const success = databases !== undefined && Array.isArray(databases);

        if (success) {
            // Succès : afficher le message de chargement approprié
            const message = isAutoLoad
                ? `${databases.length} database(s) loaded automatically`
                : `Loaded ${databases.length} database(s)`;

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
                ? 'Connection failed. Please check your credentials.'
                : 'Failed to load databases';

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