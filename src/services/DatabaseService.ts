import * as mysql from 'mysql2/promise';
import { DatabaseServeur, TableInfo, ColumnInfo } from '../types/Connection';
import { DATABASE_SYSTEM_SCHEMAS } from '../constants/AppConstants';
import { ErrorHandler } from '../utils/ErrorHandler';

export class DatabaseService {
    private serveurs: Map<string, mysql.Connection> = new Map();

    /**
     * Teste la connectivité à un serveur de base de données avec gestion détaillée des erreurs.
     * Cette méthode établit une connexion temporaire, effectue un ping de vérification,
     * et retourne un diagnostic précis en cas d'échec avec messages d'erreur explicites.
     *
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration complète du serveur à tester (sans l'ID car pas encore persisté)
     * @return {Promise<{ success: boolean, message: string }>} Résultat du test avec statut booléen et message explicatif pour l'utilisateur
     * @memberof DatabaseService
     */
    public async testConnection(serveurs: Omit<DatabaseServeur, 'id'>): Promise<{ success: boolean, message: string }> {
        try {
            const serv = await this.createServeur(serveurs);
            await serv.ping();
            await serv.end();
            return { success: true, message: 'Connexion réussie !' };
        } catch (error: any) {
            console.log('Code d\'erreur MySQL:', error.code);
            console.log('Message d\'erreur MySQL:', error.message);

            if (error.code === 'ENOTFOUND') {
                return { success: false, message: 'Host introuvable. Vérifiez l\'adresse du serveur.' };
            } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                return { success: false, message: 'Accès refusé. Vérifiez vos identifiants.' };
            } else if (error.code === 'ETIMEDOUT') {
                return { success: false, message: 'Timeout de connexion. Vérifiez le port et la connectivité réseau.' };
            } else if (error.code === 'ECONNREFUSED') {
                return { success: false, message: 'Connexion refusée. Le serveur MySQL n\'est pas démarré ou le port est incorrect.' };
            } else {
                return { success: false, message: `Erreur de connexion: ${error.code || 'Inconnue'}` };
            }
        }
    }

    /**
     * Établit une connexion persistante à un serveur de base de données après validation.
     * Cette méthode teste d'abord la connexion, ferme toute connexion existante pour ce serveur,
     * puis établit une nouvelle connexion maintenue dans le pool interne.
     *
     * @param {DatabaseServeur} serveurs Configuration complète du serveur incluant l'ID unique pour le pool de connexions
     * @return {Promise<void>} Promesse qui se résout une fois la connexion établie et stockée, ou rejette en cas d'échec
     * @memberof DatabaseService
     */
    public async connect(serveurs: DatabaseServeur): Promise<void> {
        // Tester le serveur d'abord avec gestion d'erreur personnalisée
        const testResult = await this.testConnection(serveurs);

        if (!testResult.success) {
            throw new Error(testResult.message);
        }

        await ErrorHandler.handleAsync(
            `connexion au serveur ${serveurs.name}`,
            async () => {
                // Fermer le serveur existante s'il y en a une
                await this.disconnect(serveurs.id);

                // Créer le serveur persistante
                const serv = await this.createServeur(serveurs);
                this.serveurs.set(serveurs.id, serv);

                console.log(`dao Connecté à ${serveurs.name}`);
            },
            false
        );
    }

    /**
     * Ferme proprement une connexion spécifique et la supprime du pool de connexions actives.
     * Cette méthode gère automatiquement les erreurs de déconnexion et nettoie
     * les références internes même en cas d'échec de fermeture.
     *
     * @param {string} connectionId Identifiant unique de la connexion à fermer (correspond à l'ID du serveur)
     * @return {Promise<void>} Promesse qui se résout une fois la déconnexion terminée (succès ou échec géré silencieusement)
     * @memberof DatabaseService
     */
    public async disconnect(connectionId: string): Promise<void> {
        const serv = this.serveurs.get(connectionId);
        if (serv) {
            await ErrorHandler.handleAsync(
                `déconnexion du serveur ${connectionId}`,
                async () => {
                    await serv.end();
                    this.serveurs.delete(connectionId);
                    console.log(`dao Déconnecté du serveur ${connectionId}`);
                }
            );
        }
    }

    /**
     * Vérifie si une connexion spécifique est actuellement active dans le pool de connexions.
     * Cette méthode permet de connaître l'état d'une connexion avant d'effectuer
     * des opérations nécessitant une connexion établie.
     *
     * @param {string} connectionId Identifiant unique de la connexion à vérifier (correspond à l'ID du serveur)
     * @return {boolean} true si la connexion existe et est active dans le pool, false sinon
     * @memberof DatabaseService
     */
    public isConnected(connectionId: string): boolean {
        return this.serveurs.has(connectionId);
    }

    /**
     * Récupère la liste de toutes les bases de données accessibles sur un serveur en filtrant les schémas système.
     * Cette méthode établit une connexion temporaire, exécute SHOW DATABASES,
     * et retourne uniquement les bases utilisateur (excluant information_schema, mysql, etc.).
     *
     * @param {DatabaseServeur} serveurs Configuration du serveur dont lister les bases de données
     * @return {Promise<string[]>} Promesse retournant la liste des noms de bases de données utilisateur disponibles
     * @memberof DatabaseService
     */
    public async getDatabases(serveurs: DatabaseServeur): Promise<string[]> {
        const result = await ErrorHandler.handleAsync(
            'récupération des bases de données',
            async () => {
                const serv = await this.createServeur(serveurs);
                const [rows] = await serv.execute('SHOW DATABASES');
                await serv.end();

                const databases = (rows as any[])
                    .map(row => row.Database)
                    .filter(db => !DATABASE_SYSTEM_SCHEMAS.includes(db));

                return databases;
            }
        );

        return result || [];
    }

    /**
     * Récupère la liste de toutes les tables d'une base de données spécifique sur un serveur.
     * Cette méthode utilise une connexion temporaire et la commande SHOW TABLES
     * pour obtenir les tables sans affecter les connexions persistantes.
     *
     * @param {DatabaseServeur} serveurs Configuration du serveur contenant la base de données
     * @param {string} database Nom de la base de données dont lister les tables
     * @return {Promise<string[]>} Promesse retournant la liste des noms de tables dans la base, ou tableau vide si base non spécifiée
     * @memberof DatabaseService
     */
    public async getTables(serveurs: DatabaseServeur, database: string): Promise<string[]> {
        if (!database) {
            return [];
        }

        const result = await ErrorHandler.handleAsync(
            'récupération des tables',
            async () => {
                // Utiliser un serveur temporaire comme le fait getDatabases
                const serv = await this.createServeur(serveurs);

                // Utiliser SHOW TABLES FROM database au lieu de USE + SHOW TABLES
                const [rows] = await serv.execute(`SHOW TABLES FROM \`${database}\``);

                await serv.end();

                const tableKey = `Tables_in_${database}`;
                return (rows as any[]).map(row => row[tableKey]);
            }
        );

        return result || [];
    }

    /**
     * Récupère les métadonnées complètes d'une table spécifique incluant toutes ses colonnes et leurs propriétés.
     * Cette méthode utilise DESCRIBE pour obtenir structure, types, contraintes, valeurs par défaut
     * et propriétés spéciales (auto_increment, etc.) de chaque colonne.
     *
     * @param {DatabaseServeur} serveurs Configuration du serveur contenant la table
     * @param {string} database Nom de la base de données contenant la table
     * @param {string} tableName Nom de la table dont récupérer les métadonnées complètes
     * @return {Promise<TableInfo>} Promesse retournant l'objet TableInfo avec nom et tableau détaillé de toutes les colonnes
     * @memberof DatabaseService
     */
    public async getTableInfo(serveurs: DatabaseServeur, database: string, tableName: string): Promise<TableInfo> {
        const result = await ErrorHandler.handleAsync(
            'récupération des informations de table',
            async () => {
                // Utiliser un serveur temporaire comme les autres méthodes
                const serv = await this.createServeur(serveurs);

                // Utiliser DESCRIBE database.table au lieu de USE + DESCRIBE
                const [rows] = await serv.execute(`DESCRIBE \`${database}\`.\`${tableName}\``);

                await serv.end();

                const columns: ColumnInfo[] = (rows as any[]).map(row => ({
                    name: row.Field,
                    type: row.Type,
                    nullable: row.Null === 'YES',
                    key: row.Key || '',
                    default: row.Default,
                    extra: row.Extra || ''
                }));

                return {
                    name: tableName,
                    columns
                };
            }
        );

        return result || { name: tableName, columns: [] };
    }

    /**
     * Crée une nouvelle connexion MySQL temporaire avec la configuration fournie.
     * Cette méthode privée est utilisée pour les opérations ponctuelles qui ne nécessitent
     * pas de connexion persistante (tests, requêtes d'information, etc.).
     *
     * @private
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration de connexion (host, port, credentials, etc.) sans l'ID
     * @return {Promise<mysql.Connection>} Promesse retournant une nouvelle connexion MySQL configurée et prête à utiliser
     * @memberof DatabaseService
     */
    private async createServeur(serveurs: Omit<DatabaseServeur, 'id'>): Promise<mysql.Connection> {
        const config: mysql.ConnectionOptions = {
            host: serveurs.host,
            port: serveurs.port,
            user: serveurs.username,
            password: serveurs.password,
            database: serveurs.database,
            connectTimeout: 5000
        };

        return await mysql.createConnection(config);
    }

    /**
     * Ferme toutes les connexions actives du pool et nettoie complètement les ressources.
     * Cette méthode de nettoyage est généralement appelée lors de l'arrêt de l'extension
     * ou pour réinitialiser complètement l'état des connexions.
     *
     * @return {Promise<void>} Promesse qui se résout une fois toutes les connexions fermées et le pool vidé
     * @memberof DatabaseService
     */
    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.serveurs.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}