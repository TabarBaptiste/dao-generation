import * as vscode from 'vscode';
import { DatabaseConnection, ConnectionFormData } from '../types/Connection';
import { ConnectionManager } from '../services/ConnectionManager';
import { ConnectionFormPanel } from '../panels/ConnectionFormPanel';

export class DatabaseConnectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly connection: DatabaseConnection,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(connection.name, collapsibleState);

        this.tooltip = `${connection.type}://${connection.host}:${connection.port}`;
        this.description = `${connection.host}:${connection.port}`;
        this.contextValue = 'connection';

        // Icon based on connection status
        this.iconPath = new vscode.ThemeIcon(
            connection.isConnected ? 'database' : 'circle-outline',
            connection.isConnected ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.red')
        );
    }
}

export class DatabaseConnectionProvider implements vscode.TreeDataProvider<DatabaseConnectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private connectionManager: ConnectionManager) { }

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
                connections.map(conn => new DatabaseConnectionTreeItem(conn, vscode.TreeItemCollapsibleState.None))
            );
        }

        // For now, connections don't have children (tables will be added later)
        return Promise.resolve([]);
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
}