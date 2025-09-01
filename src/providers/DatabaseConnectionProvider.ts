import * as vscode from 'vscode';
import { DatabaseConnection, ConnectionFormData } from '../types/Connection';
import { ConnectionManager } from '../services/ConnectionManager';
import { ConnectionFormPanel } from '../panels/ConnectionFormPanel';
import { TableSelectionPanel } from '../panels/TableSelectionPanel';
import { DatabaseService } from '../services/DatabaseService';

export class DatabaseConnectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly connection: DatabaseConnection,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'database' | 'table' = 'connection',
        public readonly databaseName?: string,
        public readonly tableName?: string
    ) {
        super(
            itemType === 'connection' ? connection.name : 
            itemType === 'database' ? (databaseName || '') :
            (tableName || ''), 
            collapsibleState
        );

        if (itemType === 'connection') {
            this.tooltip = `${connection.type}://${connection.host}:${connection.port}${connection.database ? '/' + connection.database : ''}`;
            this.description = `${connection.host}:${connection.port}${connection.database ? '/' + connection.database : ''}`;
            this.contextValue = connection.isConnected ? 'connectedConnection' : 'disconnectedConnection';

            // Icon based on connection status
            this.iconPath = new vscode.ThemeIcon(
                connection.isConnected ? 'database' : 'circle-outline',
                connection.isConnected ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.red')
            );
        } else if (itemType === 'database') {
            this.contextValue = 'database';
            this.iconPath = new vscode.ThemeIcon('folder-library');
            // Set command to open table selection on click
            this.command = {
                command: 'phpDaoGenerator.openTableSelection',
                title: 'Generate DAO',
                arguments: [this]
            };
        } else if (itemType === 'table') {
            this.contextValue = 'table';
            this.iconPath = new vscode.ThemeIcon('table');
        }
    }
}

export class DatabaseConnectionProvider implements vscode.TreeDataProvider<DatabaseConnectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private connectionManager: ConnectionManager,
        private databaseService: DatabaseService,
        private extensionUri: vscode.Uri
    ) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DatabaseConnectionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DatabaseConnectionTreeItem): Thenable<DatabaseConnectionTreeItem[]> {
        if (!element) {
            // Root level - return all connections
            const connections = this.connectionManager.getConnections();
            return Promise.resolve(
                connections.map(conn => new DatabaseConnectionTreeItem(
                    conn, 
                    conn.isConnected ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    'connection'
                ))
            );
        }

        if (element.itemType === 'connection' && element.connection.isConnected) {
            // Return databases for connected connection
            return this.getDatabasesForConnection(element.connection);
        }

        if (element.itemType === 'database' && element.databaseName) {
            // Return tables for database
            return this.getTablesForDatabase(element.connection, element.databaseName);
        }

        return Promise.resolve([]);
    }

    private async getDatabasesForConnection(connection: DatabaseConnection): Promise<DatabaseConnectionTreeItem[]> {
        try {
            const databases = await this.databaseService.getDatabases(connection);
            return databases.map(db => new DatabaseConnectionTreeItem(
                connection,
                vscode.TreeItemCollapsibleState.Collapsed,
                'database',
                db
            ));
        } catch (error) {
            console.error('Failed to get databases:', error);
            return [];
        }
    }

    private async getTablesForDatabase(connection: DatabaseConnection, database: string): Promise<DatabaseConnectionTreeItem[]> {
        try {
            const tables = await this.databaseService.getTables(connection, database);
            return tables.map(table => new DatabaseConnectionTreeItem(
                connection,
                vscode.TreeItemCollapsibleState.None,
                'table',
                database,
                table
            ));
        } catch (error) {
            console.error('Failed to get tables:', error);
            return [];
        }
    }

    public async addConnection(): Promise<void> {
        const panel = new ConnectionFormPanel();
        const formData = await panel.show();

        if (formData) {
            await this.connectionManager.addConnection({
                name: formData.name,
                host: formData.host,
                port: parseInt(formData.port, 10),
                username: formData.username,
                password: formData.password,
                database: formData.database || undefined,
                type: formData.type
            });

            this.refresh();
            vscode.window.showInformationMessage(`Connection "${formData.name}" added successfully!`);
        }
    }

    public async editConnection(item: DatabaseConnectionTreeItem): Promise<void> {
        const connection = item.connection;
        const panel = new ConnectionFormPanel();
        const formData = await panel.show({
            name: connection.name,
            host: connection.host,
            port: connection.port.toString(),
            username: connection.username,
            password: connection.password,
            database: connection.database || '',
            type: connection.type
        });

        if (formData) {
            await this.connectionManager.updateConnection(connection.id, {
                name: formData.name,
                host: formData.host,
                port: parseInt(formData.port, 10),
                username: formData.username,
                password: formData.password,
                database: formData.database || undefined,
                type: formData.type
            });

            this.refresh();
            vscode.window.showInformationMessage(`Connection "${formData.name}" updated successfully!`);
        }
    }

    public async deleteConnection(item: DatabaseConnectionTreeItem): Promise<void> {
        const connection = item.connection;
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the connection "${connection.name}"?`,
            { modal: true },
            'Delete'
        );

        if (result === 'Delete') {
            await this.connectionManager.deleteConnection(connection.id);
            this.refresh();
            vscode.window.showInformationMessage(`Connection "${connection.name}" deleted successfully!`);
        }
    }

    public async connectToDatabase(item: DatabaseConnectionTreeItem): Promise<void> {
        try {
            await this.databaseService.connect(item.connection);
            
            // Update connection status
            await this.connectionManager.updateConnection(item.connection.id, { 
                isConnected: true,
                lastConnected: new Date() 
            });
            
            this.refresh();
            vscode.window.showInformationMessage(`Connected to "${item.connection.name}" successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect to "${item.connection.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async disconnectFromDatabase(item: DatabaseConnectionTreeItem): Promise<void> {
        try {
            await this.databaseService.disconnect(item.connection.id);
            
            // Update connection status
            await this.connectionManager.updateConnection(item.connection.id, { 
                isConnected: false 
            });
            
            this.refresh();
            vscode.window.showInformationMessage(`Disconnected from "${item.connection.name}" successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect from "${item.connection.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async openTableSelection(item: DatabaseConnectionTreeItem): Promise<void> {
        if (item.itemType === 'database' && item.databaseName) {
            try {
                await TableSelectionPanel.createOrShow(item.connection, item.databaseName, this.databaseService, this.extensionUri);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open table selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
}