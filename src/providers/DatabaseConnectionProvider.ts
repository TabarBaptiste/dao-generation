import * as vscode from 'vscode';
import { DatabaseServeur } from '../types/Connection';
import { ServeurManager } from '../services/ConnectionManager';
import { ServeurFormPanel } from '../panels/ConnectionFormPanel';
import { TableSelectionPanel } from '../panels/TableSelectionPanel';
import { DatabaseService } from '../services/DatabaseService';
import { DatabaseServeurFactory } from '../utils/DatabaseConnectionFactory';
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
 * Élément d'arbre représentant un serveur, base de données ou table
 * Hérite de vscode.TreeItem pour l'affichage dans la vue arbre avec icônes et commandes
 */
export class DatabaseServeurTreeItem extends vscode.TreeItem {
    constructor(
        public readonly serveurs: DatabaseServeur,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'serveurs' | 'database' | 'table' = 'serveurs',
        public readonly databaseName?: string,
        public readonly tableName?: string
    ) {
        super(
            itemType === 'serveurs' ? serveurs.name :
                itemType === 'database' ? (databaseName || '') :
                    (tableName || ''),
            collapsibleState
        );

        if (itemType === 'serveurs') {
            this.tooltip = `${serveurs.type}://${serveurs.host}:${serveurs.port}${serveurs.database ? '/' + serveurs.database : ''}`;
            this.description = `${serveurs.host}:${serveurs.port}${serveurs.database ? '/' + serveurs.database : ''}`;
            this.contextValue = serveurs.isConnected ? 'connectedServeur' : 'disconnectedServeur';

            // Icône basée sur le statut du serveur
            this.iconPath = new vscode.ThemeIcon(
                serveurs.isConnected ? 'database' : 'circle-outline',
                serveurs.isConnected ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.red')
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
 * Fournisseur de données pour la vue arbre des serveurs de base de données
 * Implémente l'interface TreeDataProvider de VS Code pour gérer l'affichage hiérarchique
 */
export class DatabaseServeurProvider implements vscode.TreeDataProvider<DatabaseServeurTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DatabaseServeurTreeItem | undefined | null | void> = new vscode.EventEmitter<DatabaseServeurTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DatabaseServeurTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sortMode: 'alphabetical' | 'date' = SORT.DATE;

    constructor(
        private serveurManager: ServeurManager,
        private databaseService: DatabaseService,
        private extensionUri: vscode.Uri
    ) { }

    /**
     * Rafraîchit la vue arbre en déclenchant un événement de changement
     * Utilisé après ajout, modification ou suppression de serveurs
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Trie les serveurs selon le mode de tri actuel
     */
    private sortServeurs(serveurs: DatabaseServeur[]): DatabaseServeur[] {
        const sorted = [...serveurs]; // Copie pour éviter de muter l'original

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
        if (this.serveurManager.getServeurs().length === 0) {
            vscode.window.showInformationMessage('Aucun serveur à trier.');
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
    getTreeItem(element: DatabaseServeurTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retourne les éléments enfants d'un élément donné ou les éléments racine
     * Gère l'affichage hiérarchique : serveurs -> bases de données -> tables
     */
    getChildren(element?: DatabaseServeurTreeItem): Thenable<DatabaseServeurTreeItem[]> {
        if (!element) {
            // Retourner toutes les serveurs avec tri
            const serveurs = this.serveurManager.getServeurs();

            // Si aucun serveur n'existe, afficher le message d'état vide
            if (serveurs.length === 0) {
                return Promise.resolve([new EmptyStateTreeItem() as any]);
            }

            const sortedServeurs = this.sortServeurs(serveurs);

            // Reconnecter automatiquement les serveurs marquées comme connectées
            sortedServeurs.forEach(serv => {
                if (serv.isConnected && !this.databaseService.testConnection(serv)) {
                    this.databaseService.connect(serv).catch(error => {
                        // En cas d'échec, marquer comme déconnectée
                        this.serveurManager.updateServeur(serv.id, { isConnected: false });
                        console.warn(`Échec de reconnexion automatique pour "${serv.name}":`, error);
                    });
                }
            });

            return Promise.resolve(
                sortedServeurs.map((serv: DatabaseServeur) => new DatabaseServeurTreeItem(
                    serv,
                    serv.isConnected ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    'serveurs'
                ))
            );
        }

        if (element.itemType === 'serveurs' && element.serveurs.isConnected) {
            // Retourner les bases de données pour le serveur connectée
            return this.getDatabasesForServeur(element.serveurs);
        }

        if (element.itemType === 'database' && element.databaseName) {
            // Retourner les tables pour la base de données
            return this.getTablesForDatabase(element.serveurs, element.databaseName);
        }

        return Promise.resolve([]);
    }

    /**
     * Récupère les bases de données disponibles pour un serveur donnée
     * Retourne soit la base spécifique du serveur, soit toutes les bases disponibles
     */
    private async getDatabasesForServeur(serveurs: DatabaseServeur): Promise<DatabaseServeurTreeItem[]> {
        try {
            // Si le serveur a une base de données spécifique, afficher uniquement celle-ci
            if (serveurs.database) {
                return [new DatabaseServeurTreeItem(
                    serveurs,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'database',
                    serveurs.database
                )];
            }

            // Sinon, afficher toutes les bases de données disponibles
            const databases = await this.databaseService.getDatabases(serveurs);
            return databases.map(db => new DatabaseServeurTreeItem(
                serveurs,
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
    private async getTablesForDatabase(serveurs: DatabaseServeur, database: string): Promise<DatabaseServeurTreeItem[]> {
        try {
            const tables = await this.databaseService.getTables(serveurs, database);
            return tables.map(table => new DatabaseServeurTreeItem(
                serveurs,
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
     * Ajoute un nouveau serveur de base de données
     * Ouvre un formulaire de saisie et sauvegardu serveur si valide
     */
    public async addServeur(): Promise<void> {
        const panel = new ServeurFormPanel(this.extensionUri);
        const formData = await panel.show();

        if (formData) {
            const connectionData = DatabaseServeurFactory.createServeurData(formData);
            const wasAdded = await this.serveurManager.addServeur(connectionData);

            if (wasAdded) {
                this.refresh();
                vscode.window.showInformationMessage(`Serveur "${formData.name}" ajoutée avec succès !`);
            } else {
                // Utiliser la nouvelle fonction pour générer une description lisible
                const serverInfo = this.serveurManager.getServeurDescription(connectionData);
                vscode.window.showWarningMessage(`Le serveur "${serverInfo}" existe déjà dans vos serveurs.`);
            }
        }
    }

    /**
     * Modifie un serveur existant
     * Ouvre un formulaire pré-rempli avec les données actuelles du serveur
     */
    public async editServeur(item: DatabaseServeurTreeItem): Promise<void> {
        const serveurs = item.serveurs;
        const panel = new ServeurFormPanel(this.extensionUri, {
            name: serveurs.name,
            host: serveurs.host,
            port: serveurs.port,
            username: serveurs.username,
            password: serveurs.password,
            database: serveurs.database || '',
            type: serveurs.type,
            defaultDaoPath: serveurs.defaultDaoPath
        });
        const formData = await panel.show();

        if (formData) {
            const updateData = DatabaseServeurFactory.createServeurData(formData);
            const testConnection = await this.databaseService.testConnection(updateData);
            updateData.isConnected = testConnection.success;
            await this.serveurManager.updateServeur(serveurs.id, updateData);

            this.refresh();
            vscode.window.showInformationMessage(`Serveur "${formData.name}" mise à jour avec succès !`);
        }
    }

    /**
     * Supprime un serveur après confirmation de l'utilisateur
     * Affiche une boîte de dialogue de confirmation avant suppression
     */
    public async deleteServeur(item: DatabaseServeurTreeItem): Promise<void> {
        const serveurs = item.serveurs;
        const result = await vscode.window.showWarningMessage(
            `Êtes-vous sûr de vouloir supprimer le serveur "${serveurs.name}" ?`,
            { modal: true },
            'Supprimer'
        );

        if (result === 'Supprimer') {
            await this.serveurManager.deleteServeur(serveurs.id);
            this.refresh();
            vscode.window.showInformationMessage(`Serveur "${serveurs.name}" supprimée avec succès !`);
        }
    }

    /**
     * Établit un serveur physique à la base de données
     * Met à jour le statut et rafraîchit l'affichage en cas de succès
     */
    public async connectToDatabase(item: DatabaseServeurTreeItem): Promise<void> {
        const success = await ErrorHandler.handleAsync(
            `connexion à "${item.serveurs.name}"`,
            async () => {
                await this.databaseService.connect(item.serveurs);

                // Mettre à jour le statut de connexion
                await this.serveurManager.updateServeur(item.serveurs.id, {
                    isConnected: true,
                    lastConnected: new Date()
                });

                this.refresh();
                vscode.window.showInformationMessage(`"${item.serveurs.name}" connecté`);
                return true;
            }
        );
    }

    /**
     * Ferme un serveur active à la base de données
     * Met à jour le statut de connexion et rafraîchit l'affichage
     */
    public async disconnectFromDatabase(item: DatabaseServeurTreeItem): Promise<void> {
        const success = await ErrorHandler.handleAsync(
            `déconnexion de "${item.serveurs.name}"`,
            async () => {
                await this.databaseService.disconnect(item.serveurs.id);

                // Mettre à jour le statut de connexion
                await this.serveurManager.updateServeur(item.serveurs.id, {
                    isConnected: false
                });

                this.refresh();
                vscode.window.showInformationMessage(`"${item.serveurs.name}" déconnecté`);
                return true;
            }
        );
    }

    /**
     * Ouvre le panneau de sélection de tables pour générer les DAO
     * Détermine automatiquement la base de données à partir de l'élément sélectionné
     */
    public async openTableSelection(item: DatabaseServeurTreeItem): Promise<void> {
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
            () => TableSelectionPanel.createOrShow(item.serveurs, databaseName, this.databaseService, this.extensionUri)
        );
    }

    /**
     * Exporte toutes les serveurs vers un fichier JSON
     * Délègue le traitement au ServeurManager
     */
    public async exportServeurs(): Promise<void> {
        await this.serveurManager.exportServeurs();
    }

    /**
     * Importe des serveurs depuis un fichier JSON
     * Rafraîchit automatiquement la vue après import pour afficher les nouvelles serveurs
     */
    public async importServeurs(): Promise<void> {
        await this.serveurManager.importServeurs();
        this.refresh(); // Rafraîchir la vue de l'arbre pour afficher les serveurs importées
    }
}