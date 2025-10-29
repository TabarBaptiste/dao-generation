import * as mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { ColumnInfo, DatabaseServeur, TableInfo } from '../types/Serveur';
import { DATABASE_SYSTEM_SCHEMAS, POSTGRES_SYSTEM_SCHEMAS } from '../constants/AppConstants';
import { ErrorHandler } from '../utils/ErrorHandler';

export class DatabaseService {
    private serveurs: Map<string, mysql.Connection | PgClient> = new Map();

    /**
     * Teste la connectivité à un serveur de base de données avec gestion détaillée des erreurs.
     * Cette méthode établit une connexion temporaire, effectue un ping de vérification,
     * et retourne un diagnostic précis en cas d'échec avec messages d'erreur explicites.
     * Supporte MySQL, MariaDB et PostgreSQL.
     *
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration complète du serveur à tester (sans l'ID car pas encore persisté)
     * @return {Promise<{ success: boolean, message: string }>} Résultat du test avec statut booléen et message explicatif pour l'utilisateur
     * @memberof DatabaseService
     */
    public async testConnection(serveurs: Omit<DatabaseServeur, 'id'>): Promise<{ success: boolean, message: string }> {
        try {
            if (serveurs.type === 'postgresql') {
                const client = await this.createPostgresClient(serveurs);
                await client.connect();
                await client.query('SELECT 1');
                await client.end();
            } else {
                const serv = await this.createMySqlConnection(serveurs);
                await serv.ping();
                await serv.end();
            }
            return { success: true, message: 'Connexion réussie !' };
        } catch (error: any) {
            console.log('Code d\'erreur:', error.code);
            console.log('Message d\'erreur:', error.message);

            // Erreurs communes
            if (error.code === 'ENOTFOUND') {
                return { success: false, message: 'Host introuvable. Vérifiez l\'adresse du serveur.' };
            } else if (error.code === 'ETIMEDOUT') {
                return { success: false, message: 'Timeout de connexion. Vérifiez le port et la connectivité réseau.' };
            } else if (error.code === 'ECONNREFUSED') {
                return { success: false, message: 'Connexion refusée. Le serveur n\'est pas démarré ou le port est incorrect.' };
            }

            // Erreurs MySQL/MariaDB
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                return { success: false, message: 'Accès refusé. Vérifiez vos identifiants.' };
            }

            // Erreurs PostgreSQL
            if (error.code === '28P01') {
                return { success: false, message: 'Authentification échouée. Vérifiez vos identifiants.' };
            } else if (error.code === '3D000' || error.code === 'XX000') {
                // XX000 peut aussi indiquer une base de données inexistante
                const dbName = serveurs.database || 'non spécifiée';
                return { 
                    success: false, 
                    message: `La base de données "${dbName}" n'existe pas.\n\nVérifiez le nom de la base (généralement "neondb" pour Neon Cloud, pas le nom d'utilisateur).` 
                };
            }

            return { success: false, message: `Erreur de connexion: ${error.code || error.message || 'Inconnue'}` };
        }
    }

    /**
     * Établit une connexion persistante à un serveur de base de données après validation.
     * Cette méthode teste d'abord la connexion, ferme toute connexion existante pour ce serveur,
     * puis établit une nouvelle connexion maintenue dans le pool interne.
     *
     * @param {DatabaseServeur} serveurs Configuration complète du serveur incluant l'ID unique pour le pool de connexions
     * @return Promesse qui se résout une fois la connexion établie et stockée, ou rejette en cas d'échec
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
                const serv = serveurs.type === 'postgresql' 
                    ? await this.createPostgresClient(serveurs)
                    : await this.createMySqlConnection(serveurs);
                
                if (serveurs.type === 'postgresql') {
                    await (serv as PgClient).connect();
                }
                
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
     * @return Promesse qui se résout une fois la déconnexion terminée (succès ou échec géré silencieusement)
     * @memberof DatabaseService
     */
    public async disconnect(connectionId: string): Promise<void> {
        const serv = this.serveurs.get(connectionId);
        if (serv) {
            await ErrorHandler.handleAsync(
                `déconnexion du serveur ${connectionId}`,
                async () => {
                    if ('end' in serv && typeof serv.end === 'function') {
                        await serv.end();
                    }
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
     * Cette méthode établit une connexion temporaire, exécute SHOW DATABASES (MySQL/MariaDB) ou query sur pg_database (PostgreSQL),
     * et retourne uniquement les bases utilisateur (excluant information_schema, mysql, pg_catalog, etc.).
     *
     * @param {DatabaseServeur} serveurs Configuration du serveur dont lister les bases de données
     * @return {Promise<string[]>} Promesse retournant la liste des noms de bases de données utilisateur disponibles
     * @memberof DatabaseService
     */
    public async getDatabases(serveurs: DatabaseServeur): Promise<string[]> {
        if (serveurs.type === 'postgresql') {
            const client = await this.createPostgresClient(serveurs);
            await client.connect();
            const result = await client.query(
                'SELECT datname FROM pg_database WHERE datistemplate = false'
            );
            await client.end();

            const databases = result.rows
                .map((row: any) => row.datname)
                .filter((db: string) => !POSTGRES_SYSTEM_SCHEMAS.includes(db));

            return databases;
        } else {
            const serv = await this.createMySqlConnection(serveurs);
            const [rows] = await serv.execute('SHOW DATABASES');
            await serv.end();

            const databases = (rows as any[])
                .map(row => row.Database)
                .filter(db => !DATABASE_SYSTEM_SCHEMAS.includes(db));

            return databases;
        }
    }

    /**
     * Récupère la liste de toutes les tables d'une base de données spécifique sur un serveur.
     * Cette méthode utilise une connexion temporaire et la commande appropriée selon le type de base
     * (SHOW TABLES pour MySQL/MariaDB, query sur information_schema pour PostgreSQL).
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
                if (serveurs.type === 'postgresql') {
                    const client = await this.createPostgresClient(serveurs);
                    await client.connect();
                    const result = await client.query(
                        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
                    );
                    await client.end();
                    return result.rows.map((row: any) => row.tablename);
                } else {
                    const serv = await this.createMySqlConnection(serveurs);
                    const [rows] = await serv.execute(`SHOW TABLES FROM \`${database}\``);
                    await serv.end();
                    const tableKey = `Tables_in_${database}`;
                    return (rows as any[]).map(row => row[tableKey]);
                }
            }
        );

        return result || [];
    }

    /**
     * Récupère les métadonnées complètes d'une table spécifique incluant toutes ses colonnes et leurs propriétés.
     * Cette méthode utilise DESCRIBE (MySQL/MariaDB) ou information_schema (PostgreSQL) pour obtenir
     * structure, types, contraintes, valeurs par défaut et propriétés spéciales de chaque colonne.
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
                if (serveurs.type === 'postgresql') {
                    const client = await this.createPostgresClient(serveurs);
                    await client.connect();
                    const result = await client.query(`
                        SELECT 
                            column_name, 
                            data_type, 
                            is_nullable,
                            column_default,
                            character_maximum_length,
                            numeric_precision,
                            numeric_scale
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                        ORDER BY ordinal_position
                    `, [tableName]);
                    
                    // Récupérer les clés primaires
                    const pkResult = await client.query(`
                        SELECT a.attname
                        FROM pg_index i
                        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                        WHERE i.indrelid = $1::regclass
                        AND i.indisprimary
                    `, [`public.${tableName}`]);
                    
                    await client.end();
                    
                    const primaryKeys = pkResult.rows.map((row: any) => row.attname);

                    const columns: ColumnInfo[] = result.rows.map((row: any) => {
                        let type = row.data_type;
                        if (row.character_maximum_length) {
                            type += `(${row.character_maximum_length})`;
                        } else if (row.numeric_precision) {
                            type += `(${row.numeric_precision}${row.numeric_scale ? ',' + row.numeric_scale : ''})`;
                        }
                        
                        return {
                            name: row.column_name,
                            type: type,
                            nullable: row.is_nullable === 'YES',
                            key: primaryKeys.includes(row.column_name) ? 'PRI' : '',
                            default: row.column_default,
                            extra: row.column_default?.includes('nextval') ? 'auto_increment' : ''
                        };
                    });

                    return {
                        name: tableName,
                        columns
                    };
                } else {
                    const serv = await this.createMySqlConnection(serveurs);
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
            }
        );

        return result || { name: tableName, columns: [] };
    }

    /**
     * Crée une nouvelle connexion MySQL temporaire avec la configuration fournie.
     * Cette méthode privée est utilisée pour les opérations ponctuelles qui ne nécessitent
     * pas de connexion persistante (tests, requêtes d'information, etc.).
     * Supporte les connexions SSL/TLS avec certificats personnalisés.
     *
     * @private
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration de connexion (host, port, credentials, SSL, etc.) sans l'ID
     * @return {Promise<mysql.Connection>} Promesse retournant une nouvelle connexion MySQL configurée et prête à utiliser
     * @memberof DatabaseService
     */
    private async createMySqlConnection(serveurs: Omit<DatabaseServeur, 'id'>): Promise<mysql.Connection> {
        const config: mysql.ConnectionOptions = {
            host: serveurs.host,
            port: serveurs.port,
            user: serveurs.username,
            password: serveurs.password,
            database: serveurs.database,
            connectTimeout: 5000
        };

        // Configuration SSL/TLS si activée
        if (serveurs.ssl) {
            const sslConfig: any = {};

            // Ajouter les certificats si fournis
            if (serveurs.sslCa) {
                try {
                    const fs = require('fs');
                    sslConfig.ca = fs.readFileSync(serveurs.sslCa);
                } catch (error) {
                    console.warn('Impossible de lire le certificat CA:', error);
                }
            }

            if (serveurs.sslCert) {
                try {
                    const fs = require('fs');
                    sslConfig.cert = fs.readFileSync(serveurs.sslCert);
                } catch (error) {
                    console.warn('Impossible de lire le certificat client:', error);
                }
            }

            if (serveurs.sslKey) {
                try {
                    const fs = require('fs');
                    sslConfig.key = fs.readFileSync(serveurs.sslKey);
                } catch (error) {
                    console.warn('Impossible de lire la clé privée:', error);
                }
            }

            // Gestion de la vérification du certificat
            if (serveurs.rejectUnauthorized !== undefined) {
                sslConfig.rejectUnauthorized = serveurs.rejectUnauthorized;
            }

            // Si aucun certificat n'est fourni, activer SSL simple
            if (Object.keys(sslConfig).length === 0 || (Object.keys(sslConfig).length === 1 && 'rejectUnauthorized' in sslConfig)) {
                config.ssl = sslConfig.rejectUnauthorized !== undefined ? sslConfig : true;
            } else {
                config.ssl = sslConfig;
            }
        }

        return await mysql.createConnection(config);
    }

    /**
     * Crée un nouveau client PostgreSQL avec la configuration fournie.
     * Cette méthode privée est utilisée pour les opérations PostgreSQL ponctuelles.
     * Supporte les connexions SSL/TLS avec certificats personnalisés.
     * Active automatiquement SSL pour les domaines cloud connus (Neon, Supabase, etc.)
     *
     * @private
     * @param {Omit<DatabaseServeur, 'id'>} serveurs Configuration de connexion (host, port, credentials, SSL, etc.) sans l'ID
     * @return {PgClient} Client PostgreSQL configuré et prêt à utiliser
     * @memberof DatabaseService
     */
    private async createPostgresClient(serveurs: Omit<DatabaseServeur, 'id'>): Promise<PgClient> {
        const config: any = {
            host: serveurs.host,
            port: serveurs.port,
            user: serveurs.username,
            password: serveurs.password,
            database: serveurs.database,
            connectionTimeoutMillis: 5000
        };

        // Détecter automatiquement si SSL est nécessaire pour les fournisseurs cloud
        const cloudProviders = [
            'neon.tech',
            'supabase.co',
            'railway.app',
            'render.com',
            'amazonaws.com',
            'azure.com',
            'digitalocean.com'
        ];
        
        const isCloudHost = cloudProviders.some(provider => serveurs.host.includes(provider));
        const shouldUseSSL = serveurs.ssl || isCloudHost;

        // Configuration SSL/TLS si activée ou détectée automatiquement
        if (shouldUseSSL) {
            const sslConfig: any = {
                // Par défaut, rejeter les certificats non autorisés sauf si explicitement désactivé
                rejectUnauthorized: serveurs.rejectUnauthorized !== false
            };

            // Ajouter les certificats si fournis
            if (serveurs.sslCa) {
                try {
                    const fs = require('fs');
                    sslConfig.ca = fs.readFileSync(serveurs.sslCa);
                } catch (error) {
                    console.warn('Impossible de lire le certificat CA:', error);
                }
            }

            if (serveurs.sslCert) {
                try {
                    const fs = require('fs');
                    sslConfig.cert = fs.readFileSync(serveurs.sslCert);
                } catch (error) {
                    console.warn('Impossible de lire le certificat client:', error);
                }
            }

            if (serveurs.sslKey) {
                try {
                    const fs = require('fs');
                    sslConfig.key = fs.readFileSync(serveurs.sslKey);
                } catch (error) {
                    console.warn('Impossible de lire la clé privée:', error);
                }
            }

            config.ssl = sslConfig;
            
            if (isCloudHost) {
                console.log(`SSL automatiquement activé pour le fournisseur cloud: ${serveurs.host}`);
            }
        }

        return new PgClient(config);
    }

    /**
     * Ferme toutes les connexions actives du pool et nettoie complètement les ressources.
     * Cette méthode de nettoyage est généralement appelée lors de l'arrêt de l'extension
     * ou pour réinitialiser complètement l'état des connexions.
     *
     * @return Promesse qui se résout une fois toutes les connexions fermées et le pool vidé
     * @memberof DatabaseService
     */
    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.serveurs.keys()).map(id => this.disconnect(id));
        await Promise.all(disconnectPromises);
    }
}