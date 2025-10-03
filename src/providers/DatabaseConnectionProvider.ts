import * as vscode from 'vscode';
import { DatabaseServeur } from '../types/Serveur';
import { ServeurManager } from '../services/ConnectionManager';
import { ServeurFormPanel } from '../panels/ConnectionFormPanel';
import { TableSelectionPanel } from '../panels/TableSelectionPanel';
import { DatabaseService } from '../services/DatabaseService';
import { DatabaseServeurFactory } from '../utils/DatabaseConnectionFactory';
import { ErrorHandler } from '../utils/ErrorHandler';
import { SORT } from '../constants/AppConstants';

/**
 * Élément d'arbre spécialisé pour afficher un message informatif quand aucun serveur n'est configuré.
 * Cette classe hérite de vscode.TreeItem et fournit une interface utilisateur claire
 * pour indiquer l'état vide de la liste des connexions avec une icône appropriée.
 * 
 * @extends {vscode.TreeItem}
 */
export class EmptyStateTreeItem extends vscode.TreeItem {
    constructor() {
        super('Aucun serveur trouvé', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'emptyState';
    }
}

/**
 * Élément d'arbre polyvalent représentant les différents niveaux hiérarchiques de la structure de base de données.
 * Cette classe peut représenter un serveur, une base de données ou une table selon le contexte,
 * avec des icônes, tooltips et commandes appropriées pour chaque type d'élément.
 * 
 * @extends {vscode.TreeItem}
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
 * Fournisseur de données principal pour la vue arbre des connexions de base de données dans VS Code.
 * Cette classe implémente l'interface TreeDataProvider et gère l'affichage hiérarchique complet
 * des serveurs, bases de données et tables avec toutes les opérations de gestion des connexions.
 *
 * @export
 * @class DatabaseServeurProvider
 * @implements {vscode.TreeDataProvider<DatabaseServeurTreeItem>}
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
     * Déclenche un rafraîchissement complet de la vue arbre en émettant un événement de changement.
     * Cette méthode est utilisée après toute modification des données (ajout, suppression, modification de serveurs)
     * pour s'assurer que l'interface utilisateur reflète l'état actuel des connexions.
     *
     * @return {void} Ne retourne rien, mais déclenche la mise à jour de l'affichage de l'arbre
     * @memberof DatabaseServeurProvider
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Trie la liste des serveurs selon le mode de tri actuellement sélectionné.
     * Cette méthode crée une copie des serveurs pour éviter les mutations et applique
     * soit un tri alphabétique par nom, soit un tri par ordre d'ajout (chronologique).
     *
     * @private
     * @param {DatabaseServeur[]} serveurs - Tableau original des serveurs à trier
     * @return {DatabaseServeur[]} Nouveau tableau trié selon le mode de tri actuel, sans modifier l'original
     * @memberof DatabaseServeurProvider
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
     * Bascule entre les deux modes de tri disponibles et rafraîchit immédiatement la vue.
     * Cette méthode alterne entre tri alphabétique par nom et tri par date d'ajout,
     * en informant l'utilisateur du mode actuellement appliqué via une notification.
     *
     * @return {void} Ne retourne rien, mais change le mode de tri et rafraîchit l'affichage
     * @memberof DatabaseServeurProvider
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
     * Retourne la représentation d'affichage d'un élément d'arbre pour VS Code.
     * Cette méthode est requise par l'interface TreeDataProvider et retourne simplement
     * l'élément tel quel car il hérite déjà de vscode.TreeItem.
     *
     * @param {DatabaseServeurTreeItem} element - Élément d'arbre à afficher dans l'interface VS Code
     * @return {vscode.TreeItem} L'élément lui-même, prêt pour l'affichage dans la vue arbre
     * @memberof DatabaseServeurProvider
     */
    getTreeItem(element: DatabaseServeurTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Retourne les éléments enfants d'un nœud donné ou les éléments racine de l'arbre.
     * Cette méthode gère la structure hiérarchique complète : serveurs -> bases de données -> tables,
     * avec tri automatique, reconnexion des serveurs et gestion de l'état vide.
     *
     * @param {DatabaseServeurTreeItem} [element] - Élément parent dont on veut les enfants, ou undefined pour les éléments racine
     * @return {Thenable<DatabaseServeurTreeItem[]>} Promise contenant les éléments enfants appropriés selon le niveau hiérarchique
     * @memberof DatabaseServeurProvider
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
     * Récupère et formate les bases de données disponibles pour un serveur connecté.
     * Cette méthode gère deux cas : serveurs avec base de données spécifique (affichage unique)
     * ou serveurs génériques (affichage de toutes les bases disponibles).
     *
     * @private
     * @param {DatabaseServeur} serveurs - Configuration du serveur pour lequel récupérer les bases de données
     * @return {Promise<DatabaseServeurTreeItem[]>} Promise contenant les éléments d'arbre représentant les bases de données disponibles
     * @memberof DatabaseServeurProvider
     */
    private async getDatabasesForServeur(serveurs: DatabaseServeur): Promise<DatabaseServeurTreeItem[]> {
        const result = await ErrorHandler.handleAsync(
            'récupération des bases de données',
            async () => {
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
            }
        );
        return result || [];
    }

    /**
     * Récupère et formate la liste des tables d'une base de données spécifique.
     * Cette méthode interroge le service de base de données pour obtenir les métadonnées des tables
     * et les transforme en éléments d'arbre affichables avec les icônes appropriées.
     *
     * @private
     * @param {DatabaseServeur} serveurs - Configuration du serveur contenant la base de données
     * @param {string} database - Nom de la base de données dont on veut récupérer les tables
     * @return {Promise<DatabaseServeurTreeItem[]>} Promise contenant les éléments d'arbre représentant les tables de la base
     * @memberof DatabaseServeurProvider
     */
    private async getTablesForDatabase(serveurs: DatabaseServeur, database: string): Promise<DatabaseServeurTreeItem[]> {
        const success = await ErrorHandler.handleAsync(
            'récupération des tables',
            async () => {
                const tables = await this.databaseService.getTables(serveurs, database);
                return tables.map(table => new DatabaseServeurTreeItem(
                    serveurs,
                    vscode.TreeItemCollapsibleState.None,
                    'table',
                    database,
                    table
                ));
            }
        );
        return success || [];
    }

    /**
     * Lance le processus d'ajout d'un nouveau serveur de base de données via un formulaire interactif.
     * Cette méthode ouvre le panneau de formulaire, attend les données saisies par l'utilisateur,
     * valide et sauvegarde la nouvelle connexion, puis rafraîchit l'affichage.
     *
     * @return {Promise<void>} Promise qui se résout une fois le serveur ajouté et la vue rafraîchie, ou si l'opération est annulée
     * @memberof DatabaseServeurProvider
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
     * Ouvre un formulaire de modification pré-rempli pour un serveur existant.
     * Cette méthode récupère les données actuelles du serveur, les charge dans le formulaire,
     * attend les modifications de l'utilisateur, puis sauvegarde et rafraîchit l'affichage.
     *
     * @param {DatabaseServeurTreeItem} item - Élément d'arbre représentant le serveur à modifier
     * @return {Promise<void>} Promise qui se résout une fois les modifications sauvegardées et la vue rafraîchie
     * @memberof DatabaseServeurProvider
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
     * Supprime un serveur après avoir obtenu une confirmation explicite de l'utilisateur.
     * Cette méthode affiche une boîte de dialogue modale de confirmation pour éviter les suppressions accidentelles,
     * puis procède à la suppression et rafraîchit l'affichage si confirmé.
     *
     * @param {DatabaseServeurTreeItem} item - Élément d'arbre représentant le serveur à supprimer
     * @return {Promise<void>} Promise qui se résout une fois le serveur supprimé et la vue rafraîchie, ou si l'opération est annulée
     * @memberof DatabaseServeurProvider
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
     * Établit une connexion physique à la base de données pour un serveur donné.
     * Cette méthode teste la connectivité, met à jour le statut de connexion en cas de succès,
     * sauvegarde l'état et rafraîchit l'affichage avec gestion d'erreurs intégrée.
     *
     * @param {DatabaseServeurTreeItem} item - Élément d'arbre représentant le serveur auquel se connecter
     * @return {Promise<void>} Promise qui se résout une fois la connexion établie et le statut mis à jour
     * @memberof DatabaseServeurProvider
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
     * Ferme une connexion active à la base de données et met à jour le statut.
     * Cette méthode termine proprement la connexion au serveur, sauvegarde le nouvel état
     * de déconnexion et rafraîchit l'affichage pour refléter le changement.
     *
     * @param {DatabaseServeurTreeItem} item - Élément d'arbre représentant le serveur dont on veut fermer la connexion
     * @return {Promise<void>} Promise qui se résout une fois la déconnexion effectuée et le statut mis à jour
     * @memberof DatabaseServeurProvider
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
     * Ouvre le panneau de sélection de tables pour la génération de fichiers DAO.
     * Cette méthode détermine automatiquement la base de données concernée selon le type d'élément sélectionné
     * (base de données ou table) et lance l'interface de sélection appropriée.
     *
     * @param {DatabaseServeurTreeItem} item - Élément d'arbre représentant une base de données ou une table
     * @return {Promise<void>} Promise qui se résout une fois le panneau de sélection ouvert ou en cas d'erreur
     * @memberof DatabaseServeurProvider
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
     * Exporte toutes les configurations de serveurs vers un fichier JSON pour sauvegarde ou partage.
     * Cette méthode délègue le traitement complet au ServeurManager qui gère la sérialisation,
     * la sélection du fichier de destination et la confirmation de l'export.
     *
     * @return {Promise<void>} Promise qui se résout une fois l'export terminé ou annulé par l'utilisateur
     * @memberof DatabaseServeurProvider
     */
    public async exportServeurs(): Promise<void> {
        await this.serveurManager.exportServeurs();
    }

    /**
     * Importe des configurations de serveurs depuis un fichier JSON externe.
     * Cette méthode délègue le traitement au ServeurManager pour la désérialisation et la validation,
     * puis rafraîchit automatiquement la vue pour afficher les nouvelles connexions importées.
     *
     * @return {Promise<void>} Promise qui se résout une fois l'import terminé et la vue rafraîchie
     * @memberof DatabaseServeurProvider
     */
    public async importServeurs(): Promise<void> {
        await this.serveurManager.importServeurs();
        this.refresh(); // Rafraîchir la vue de l'arbre pour afficher les serveurs importées
    }
}