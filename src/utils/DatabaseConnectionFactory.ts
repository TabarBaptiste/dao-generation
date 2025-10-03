import { DatabaseServeur, ServeurFormData } from '../types/Serveur';

/**
 * Classe factory pour la création d'objets de connexion de base de données (serveurs).
 * Centralise la logique de création des serveurs pour éliminer les duplications et garantir la cohérence.
 */
export class DatabaseServeurFactory {
    /**
     * Crée un objet DatabaseServeur complet (sans l'ID) à partir des données du formulaire pour la persistance.
     * Cette méthode transforme les saisies utilisateur en un objet serveur correctement structuré,
     * prêt pour la validation, le test et le stockage par le gestionnaire de serveurs.
     * 
     * @static
     * @param {ServeurFormData} data Données brutes issues du formulaire contenant tous les champs de configuration du serveur
     * @return {Omit<DatabaseServeur, 'id'>} Objet serveur complet sans l'ID auto-généré, prêt pour la persistance
     * @memberof DatabaseServeurFactory
     */
    static createServeurData(data: ServeurFormData): Omit<DatabaseServeur, 'id'> {
        return {
            name: data.name,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password || '',
            database: data.database || undefined,
            type: data.type,
            isConnected: false,
            defaultDaoPath: data.defaultDaoPath
        };
    }

    /**
     * Crée un objet serveur temporaire avec un ID prédéfini pour les tests et la validation.
     * Cette méthode génère un objet DatabaseServeur avec un identifiant temporaire pour les
     * opérations nécessitant une structure complète sans persistance permanente.
     * 
     * @static
     * @param {object} data Données brutes de configuration du serveur provenant des formulaires ou de l'UI
     * @param {string} data.name Nom d'affichage pour la connexion serveur
     * @param {string} data.host Nom d'hôte ou adresse IP du serveur de base de données
     * @param {number} data.port Numéro de port du serveur de base de données (généralement 3306 pour MySQL/MariaDB)
     * @param {string} data.username Nom d'utilisateur pour l'authentification
     * @param {string} [data.password] Mot de passe pour l'authentification (optionnel, par défaut chaîne vide)
     * @param {string} [data.database] Nom de la base de données spécifique à utiliser (optionnel)
     * @param {'mysql' | 'mariadb'} data.type Type de serveur de base de données (MySQL ou MariaDB)
     * @return {DatabaseServeur} Objet DatabaseServeur complet avec l'ID temporaire "temp" pour tests/validation
     * @memberof DatabaseServeurFactory
     */
    static createTempServeur(data: {
        name: string;
        host: string;
        port: number;
        username: string;
        password?: string;
        database?: string;
        type: 'mysql' | 'mariadb';
    }): DatabaseServeur {
        return {
            id: 'temp',
            name: data.name,
            host: data.host,
            port: data.port,
            username: data.username,
            password: data.password || '',
            database: data.database,
            type: data.type,
            isConnected: false
        };
    }
}