import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';
import * as fs from 'fs';
import * as path from 'path';

export class ConnectionManager {
    private static readonly STORAGE_KEY = 'phpDaoGenerator.connections';
    private connections: DatabaseConnection[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadConnections();
    }

    public getConnections(): DatabaseConnection[] {
        return this.connections;
    }

    public async addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<void> {
        const newConnection: DatabaseConnection = {
            ...connection,
            id: this.generateId(),
            isConnected: false
        };

        this.connections.push(newConnection);
        await this.saveConnections();
    }

    public async updateConnection(id: string, connection: Partial<DatabaseConnection>): Promise<void> {
        const index = this.connections.findIndex(conn => conn.id === id);
        if (index !== -1) {
            this.connections[index] = { ...this.connections[index], ...connection };
            await this.saveConnections();
        }
    }

    public async deleteConnection(id: string): Promise<void> {
        this.connections = this.connections.filter(conn => conn.id !== id);
        await this.saveConnections();
    }

    public getConnectionById(id: string): DatabaseConnection | undefined {
        return this.connections.find(conn => conn.id === id);
    }

    private async loadConnections(): Promise<void> {
        const stored = this.context.globalState.get<DatabaseConnection[]>(ConnectionManager.STORAGE_KEY);
        console.log('stored :', stored);
        if (stored) {
            this.connections = stored;
        }
    }

    private async saveConnections(): Promise<void> {
        await this.context.globalState.update(ConnectionManager.STORAGE_KEY, this.connections);
    }

    private generateId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public async exportConnections(): Promise<void> {
        try {
            if (this.connections.length === 0) {
                vscode.window.showInformationMessage('No connections to export.');
                return;
            }

            // Create export data structure
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0.0',
                connections: this.connections.map(conn => ({
                    ...conn,
                    // Remove runtime properties that shouldn't be exported
                    isConnected: undefined,
                    lastConnected: undefined
                }))
            };

            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('php-dao-connections.json'),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                saveLabel: 'Export Connections'
            });

            if (saveUri) {
                const jsonContent = JSON.stringify(exportData, null, 2);
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(jsonContent, 'utf8'));
                vscode.window.showInformationMessage(`Successfully exported ${this.connections.length} connection(s) to ${saveUri.fsPath}`);
            }
        } catch (error) {
            console.error('Export error:', error);
            vscode.window.showErrorMessage(`Failed to export connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async importConnections(): Promise<void> {
        try {
            // Show open dialog
            const openUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                openLabel: 'Import Connections'
            });

            if (!openUri || openUri.length === 0) {
                return;
            }

            const fileUri = openUri[0];
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const jsonContent = Buffer.from(fileContent).toString('utf8');
            
            let importData: any;
            try {
                importData = JSON.parse(jsonContent);
            } catch (parseError) {
                throw new Error('Invalid JSON file format');
            }

            // Validate import data structure
            if (!importData.connections || !Array.isArray(importData.connections)) {
                throw new Error('Invalid file format: missing connections array');
            }

            // Validate connections format
            const validConnections = importData.connections.filter((conn: any) => {
                return conn.name && conn.host && conn.port && conn.username && 
                       conn.type && ['mysql', 'mariadb'].includes(conn.type);
            });

            if (validConnections.length === 0) {
                throw new Error('No valid connections found in the import file');
            }

            // Ask user if they want to replace existing connections or merge
            let shouldReplace = false;
            if (this.connections.length > 0) {
                const choice = await vscode.window.showQuickPick([
                    { label: 'Merge', description: 'Add imported connections to existing ones', value: 'merge' },
                    { label: 'Replace', description: 'Replace all existing connections with imported ones', value: 'replace' }
                ], {
                    placeHolder: 'Choose import mode'
                });

                if (!choice) {
                    return; // User cancelled
                }
                
                shouldReplace = choice.value === 'replace';
            }

            // Import connections
            const importedConnections: DatabaseConnection[] = validConnections.map((conn: any) => ({
                ...conn,
                id: this.generateId(),
                isConnected: false,
                lastConnected: undefined
            }));

            if (shouldReplace) {
                this.connections = importedConnections;
            } else {
                this.connections.push(...importedConnections);
            }

            await this.saveConnections();

            vscode.window.showInformationMessage(
                `Successfully imported ${importedConnections.length} connection(s)${
                    validConnections.length < importData.connections.length 
                        ? ` (${importData.connections.length - validConnections.length} invalid connections skipped)`
                        : ''
                }`
            );
        } catch (error) {
            console.error('Import error:', error);
            vscode.window.showErrorMessage(`Failed to import connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}