import * as vscode from 'vscode';
import { DatabaseConnection } from '../types/Connection';
import { ConnectionManager } from '../services/ConnectionManager';
import { ConnectionFormPanel } from '../panels/ConnectionFormPanel';
import { TableSelectionPanel } from '../panels/TableSelectionPanel';
import { DatabaseService } from '../services/DatabaseService';
import { DatabaseConnectionFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';
import { SORT } from '../constants/AppConstants';

/**
 * Élément d'arbre pour afficher un message quand aucun serveur n'est trouvé
 * Hérite de vscode.TreeItem pour l'affichage dans la vue arbre
 */
export class EmptyStateTreeItem extends vscode.TreeItem {
    constructor() {
        super('Aucun serveur trouvé', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'emptyState';
    }
}

/**
 * Élément d'arbre représentant une connexion, base de données ou table
 * Hérite de vscode.TreeItem pour l'affichage dans la vue arbre avec icônes et commandes
 */
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

/**
 * Fournisseur de données pour la vue arbre des connexions de base de données
 * Implémente l'interface TreeDataProvider de VS Code pour gérer l'affichage hiérarchique
 */
export class DatabaseConnectionProvider implements vscode.TreeDataProvider<DatabaseConnectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseConnectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sortMode: 'alphabetical' | 'date' = SORT.DATE;
    private connections: DatabaseConnection[] = [];

    constructor(
        private connectionManager: ConnectionManager,
        private databaseService: DatabaseService,
        private extensionUri: vscode.Uri
    ) { }

    /**
     * Rafraîchit la vue arbre en déclenchant un événement de changement
     * Utilisé après ajout, modification ou suppression de connexions
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Trie les connexions selon le mode de tri actuel
     */
    private sortConnections(connections: DatabaseConnection[]): DatabaseConnection[] {
        const sorted = [...connections]; // Copie pour éviter de muter l'original

        if (this.sortMode === SORT.ALPHABETICAL) {
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
     * Alterne entre tri alphabétique et tri par date d'ajout
     */
    public toggleSortMode(): void {
        if (this.connections.length === 0) {
            vscode.window.showInformationMessage('Aucune connexion à trier.');
            return;
        }

        this.sortMode = this.sortMode === SORT.ALPHABETICAL ? SORT.DATE : SORT.ALPHABETICAL;

        // Afficher le mode de tri actuel
        const sortModeText = this.sortMode === SORT.ALPHABETICAL ? 'ordre alphabétique' : 'date d\'ajout';
        vscode.window.showInformationMessage(`Connexions triées par ${sortModeText}`);

        this.refresh();
    }

    /**
     * Retourne l'élément d'arbre pour l'affichage VS Code
     * Méthode requise par l'interface TreeDataProvider
     */
    getTreeItem(element: DatabaseConnectionTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retourne les éléments enfants d'un élément donné ou les éléments racine
     * Gère l'affichage hiérarchique : connexions -> bases de données -> tables
     */
    getChildren(element?: DatabaseConnectionTreeItem): Thenable<DatabaseConnectionTreeItem[]> {
        if (!element) {
            // Retourner toutes les connexions avec tri
            const connections = this.connectionManager.getConnections();

            // Si aucune connexion n'existe, afficher le message d'état vide
            if (connections.length === 0) {
                return Promise.resolve([new EmptyStateTreeItem() as any]);
            }

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

    /**
     * Récupère les bases de données disponibles pour une connexion donnée
     * Retourne soit la base spécifique de la connexion, soit toutes les bases disponibles
     */
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

    /**
     * Récupère les tables d'une base de données spécifique
     * Transforme la liste des tables en éléments d'arbre affichables
     */
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

    /**
     * Ajoute une nouvelle connexion de base de données
     * Ouvre un formulaire de saisie et sauvegarde la connexion si valide
     */
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

    /**
     * Modifie une connexion existante
     * Ouvre un formulaire pré-rempli avec les données actuelles de la connexion
     */
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

    /**
     * Supprime une connexion après confirmation de l'utilisateur
     * Affiche une boîte de dialogue de confirmation avant suppression
     */
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

    /**
     * Établit une connexion physique à la base de données
     * Met à jour le statut et rafraîchit l'affichage en cas de succès
     */
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

    /**
     * Ferme une connexion active à la base de données
     * Met à jour le statut de connexion et rafraîchit l'affichage
     */
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

    /**
     * Ouvre le panneau de sélection de tables pour générer les DAO
     * Détermine automatiquement la base de données à partir de l'élément sélectionné
     */
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

    /**
     * Exporte toutes les connexions vers un fichier JSON
     * Délègue le traitement au ConnectionManager
     */
    public async exportConnections(): Promise<void> {
        await this.connectionManager.exportConnections();
    }

    /**
     * Importe des connexions depuis un fichier JSON
     * Rafraîchit automatiquement la vue après import pour afficher les nouvelles connexions
     */
    public async importConnections(): Promise<void> {
        await this.connectionManager.importConnections();
        this.refresh(); // Rafraîchir la vue de l'arbre pour afficher les connexions importées
    }
}