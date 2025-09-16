import * as vscode from 'vscode';
import { DatabaseConnection, ConnectionFormData } from '../types/Connection';
import { ConnectionManager } from '../services/ConnectionManager';
import { ConnectionFormPanel } from '../panels/ConnectionFormPanel';
import { TableSelectionPanel } from '../panels/TableSelectionPanel';
import { DatabaseService } from '../services/DatabaseService';
import { DatabaseConnectionFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';

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

            // Icône basée sur le statut de connexion
            this.iconPath = new vscode.ThemeIcon(
                connection.isConnected ? 'database' : 'circle-outline',
                connection.isConnected ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.red')
            );
        } else if (itemType === 'database') {
            this.contextValue = 'database';
            this.iconPath = new vscode.ThemeIcon('folder-library');
            // Définir la commande pour ouvrir la sélection de table au clic
            this.command = {
                command: 'phpDaoGenerator.openTableSelection',
                title: 'Générer DAO',
                arguments: [this]
            };
        } else if (itemType === 'table') {
            this.contextValue = 'table';
            this.iconPath = new vscode.ThemeIcon('table');
            // Définir la commande pour ouvrir la sélection de table au clic
            this.command = {
                command: 'phpDaoGenerator.openTableSelection',
                title: 'Générer DAO',
                arguments: [this]
            };
        }
    }
}

export class DatabaseConnectionProvider implements vscode.TreeDataProvider<DatabaseConnectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sortMode: 'alphabetical' | 'date' = 'date';

    constructor(
        private connectionManager: ConnectionManager,
        private databaseService: DatabaseService,
        private extensionUri: vscode.Uri
    ) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Trie les connexions selon le mode de tri actuel
     */
    private sortConnections(connections: DatabaseConnection[]): DatabaseConnection[] {
        const sorted = [...connections]; // Copie pour éviter de muter l'original

        if (this.sortMode === 'alphabetical') {
            // Tri alphabétique par nom
            return sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        } else {
            // Tri par date d'ajout (ordre par défaut du tableau, ou par ID si disponible)
            return sorted.sort((a, b) => {
                // Extraire le timestamp de l'ID (format: conn_timestamp_randomstring)
                const timestampA = parseInt(a.id.split('_')[1]) || 0;
                const timestampB = parseInt(b.id.split('_')[1]) || 0;
                return timestampB - timestampA; // Plus récent en premier
            });
        }
    }

    /**
     * Bascule entre les modes de tri et rafraîchit la vue
     */
    public toggleSortMode(): void {
        this.sortMode = this.sortMode === 'alphabetical' ? 'date' : 'alphabetical';

        // Afficher le mode de tri actuel
        const sortModeText = this.sortMode === 'alphabetical' ? 'alphabétique' : 'date d\'ajout';
        vscode.window.showInformationMessage(`Connexions triées par ${sortModeText}`);

        this.refresh();
    }

    getTreeItem(element: DatabaseConnectionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DatabaseConnectionTreeItem): Thenable<DatabaseConnectionTreeItem[]> {
        if (!element) {
            // Return all connections with sorting
            const connections = this.connectionManager.getConnections();
            const sortedConnections = this.sortConnections(connections);
            
            // Reconnecter automatiquement les connexions marquées comme connectées
            sortedConnections.forEach(conn => {
                if (conn.isConnected && !this.databaseService.isConnected(conn.id)) {
                    this.databaseService.connect(conn).catch(error => {
                        // En cas d'échec, marquer comme déconnectée
                        this.connectionManager.updateConnection(conn.id, { isConnected: false });
                        console.warn(`Échec de reconnexion automatique pour "${conn.name}":`, error);
                    });
                }
            });
            
            return Promise.resolve(
                sortedConnections.map((conn: DatabaseConnection) => new DatabaseConnectionTreeItem(
                    conn,
                    conn.isConnected ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    'connection'
                ))
            );
        }

        if (element.itemType === 'connection' && element.connection.isConnected) {
            // Retourner les bases de données pour la connexion connectée
            return this.getDatabasesForConnection(element.connection);
        }

        if (element.itemType === 'database' && element.databaseName) {
            // Retourner les tables pour la base de données
            return this.getTablesForDatabase(element.connection, element.databaseName);
        }

        return Promise.resolve([]);
    }

    private async getDatabasesForConnection(connection: DatabaseConnection): Promise<DatabaseConnectionTreeItem[]> {
        try {
            // Si la connexion a une base de données spécifique, afficher uniquement celle-ci
            if (connection.database) {
                return [new DatabaseConnectionTreeItem(
                    connection,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'database',
                    connection.database
                )];
            }

            // Sinon, afficher toutes les bases de données disponibles
            const databases = await this.databaseService.getDatabases(connection);
            return databases.map(db => new DatabaseConnectionTreeItem(
                connection,
                vscode.TreeItemCollapsibleState.Collapsed,
                'database',
                db
            ));
        } catch (error) {
            console.error('Échec de récupération des bases de données :', error);
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
            console.error('Échec de récupération des tables :', error);
            return [];
        }
    }

    public async addConnection(): Promise<void> {
        const panel = new ConnectionFormPanel(this.extensionUri);
        const formData = await panel.show();

        if (formData) {
            const connectionData = DatabaseConnectionFactory.createConnectionData(formData);
            const wasAdded = await this.connectionManager.addConnection(connectionData);

            if (wasAdded) {
                this.refresh();
                vscode.window.showInformationMessage(`Connexion "${formData.name}" ajoutée avec succès !`);
            } else {
                // Utiliser la nouvelle fonction pour générer une description lisible
                const serverInfo = this.connectionManager.getConnectionDescription(connectionData);
                vscode.window.showWarningMessage(`Le serveur "${serverInfo}" existe déjà dans vos connexions.`);
            }
        }
    }

    public async editConnection(item: DatabaseConnectionTreeItem): Promise<void> {
        const connection = item.connection;
        const panel = new ConnectionFormPanel(this.extensionUri, {
            name: connection.name,
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.password,
            database: connection.database || '',
            type: connection.type
        });
        const formData = await panel.show();

        if (formData) {
            const updateData = DatabaseConnectionFactory.createConnectionData(formData);
            await this.connectionManager.updateConnection(connection.id, updateData);

            this.refresh();
            vscode.window.showInformationMessage(`Connexion "${formData.name}" mise à jour avec succès !`);
        }
    }

    public async deleteConnection(item: DatabaseConnectionTreeItem): Promise<void> {
        const connection = item.connection;
        const result = await vscode.window.showWarningMessage(
            `Êtes-vous sûr de vouloir supprimer la connexion "${connection.name}" ?`,
            { modal: true },
            'Supprimer'
        );

        if (result === 'Supprimer') {
            await this.connectionManager.deleteConnection(connection.id);
            this.refresh();
            vscode.window.showInformationMessage(`Connexion "${connection.name}" supprimée avec succès !`);
        }
    }

    public async connectToDatabase(item: DatabaseConnectionTreeItem): Promise<void> {
        const success = await ErrorHandler.handleAsync(
            `connexion à "${item.connection.name}"`,
            async () => {
                await this.databaseService.connect(item.connection);

                // Mettre à jour le statut de connexion
                await this.connectionManager.updateConnection(item.connection.id, {
                    isConnected: true,
                    lastConnected: new Date()
                });

                this.refresh();
                vscode.window.showInformationMessage(`"${item.connection.name}" connecté`);
                return true;
            }
        );
    }

    public async disconnectFromDatabase(item: DatabaseConnectionTreeItem): Promise<void> {
        const success = await ErrorHandler.handleAsync(
            `déconnexion de "${item.connection.name}"`,
            async () => {
                await this.databaseService.disconnect(item.connection.id);

                // Mettre à jour le statut de connexion
                await this.connectionManager.updateConnection(item.connection.id, {
                    isConnected: false
                });

                this.refresh();
                vscode.window.showInformationMessage(`"${item.connection.name}" déconnecté`);
                return true;
            }
        );
    }

    public async openTableSelection(item: DatabaseConnectionTreeItem): Promise<void> {
        let databaseName: string;

        if (item.itemType === 'database' && item.databaseName) {
            databaseName = item.databaseName;
        } else if (item.itemType === 'table' && item.databaseName) {
            databaseName = item.databaseName;
        } else {
            vscode.window.showErrorMessage('Impossible de déterminer la base de données pour la sélection de table.');
            return;
        }

        await ErrorHandler.handleAsync(
            'ouverture de la sélection de table',
            () => TableSelectionPanel.createOrShow(item.connection, databaseName, this.databaseService, this.extensionUri)
        );
    }

    public async exportConnections(): Promise<void> {
        await this.connectionManager.exportConnections();
    }

    public async importConnections(): Promise<void> {
        await this.connectionManager.importConnections();
        this.refresh(); // Rafraîchir la vue de l'arbre pour afficher les connexions importées
    }
}