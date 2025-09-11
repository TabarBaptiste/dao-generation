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

    public async show(existingData?: ConnectionFormData, extensionUri?: vscode.Uri): Promise<ConnectionFormData | undefined> {
        return new Promise(async (resolve) => {
            this.resolve = resolve;
            this.existingData = existingData;
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
                await this.handleLoadDatabases(message.data);
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

    private async handleLoadDatabases(data: any): Promise<void> {
        const connectionData = DatabaseConnectionFactory.createTempConnection(data);

        const databases = await ErrorHandler.handleAsync(
            'load databases',
            () => this.databaseService.getDatabases(connectionData),
            false
        );

        this.sendMessage({
            command: 'databasesLoaded',
            databases: databases || [],
            error: databases ? undefined : 'Failed to load databases'
        });
    }
}