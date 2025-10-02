import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseServeur, TableInfo, ColumnInfo } from '../types/Connection';
import { DatabaseService } from './DatabaseService';
import { StringUtil } from '../utils/StringUtil';
import { DateUtil } from '../utils/DateUtil';
import { ErrorHandler } from '../utils/ErrorHandler';
import { DEFAULT_PATHS, FILE_EXTENSIONS, VERSION_PATTERN } from '../constants/AppConstants';

interface DaoGenerationOptions {
    mode: 'save' | 'overwrite';
    outputPath?: string;
}

export class DaoGeneratorService {
    constructor(private databaseService: DatabaseService) { }

    /**
     * Génère automatiquement les fichiers DAO PHP pour les tables sélectionnées d'une base de données.
     * Cette méthode orchestre tout le processus de génération : création du dossier de destination,
     * récupération des métadonnées des tables, génération du code PHP et sauvegarde des fichiers.
     *
     * @param {DatabaseServeur} serveurs Objet contenant les informations de connexion au serveur de base de données (host, port, user, etc.)
     * @param {string} database Nom de la base de données contenant les tables à traiter
     * @param {string[]} tableNames Liste des noms de tables pour lesquelles générer les fichiers DAO
     * @param {DaoGenerationOptions} options Options de génération incluant le mode (save/overwrite) et le chemin de sortie optionnel
     * @return {Promise<void>} Promesse qui se résout une fois la génération terminée (succès ou échec)
     * @memberof DaoGeneratorService
     */
    public async generateDaoFiles(
        serveurs: DatabaseServeur,
        database: string,
        tableNames: string[],
        options: DaoGenerationOptions
    ): Promise<void> {
        await ErrorHandler.handleAsync(
            'génération des fichiers DAO',
            async () => {
                // Utiliser le defaultDaoPath du serveur si disponible, sinon demander le dossier
                const suggestedPath = serveurs.defaultDaoPath || options.outputPath;
                const outputFolder = await this.getOutputFolder(suggestedPath, database, serveurs.defaultDaoPath);
                if (!outputFolder) {
                    vscode.window.showWarningMessage('Génération annulée : aucun dossier sélectionné.');
                    return;
                }

                // Afficher un message de confirmation avec le chemin de destination
                // vscode.window.showInformationMessage(`Génération des DAO dans: ${outputFolder}`);

                let generatedCount = 0;
                let skippedCount = 0;
                let backupCount = 0;
                const errors: string[] = [];
                const generatedFiles: string[] = [];

                for (const tableName of tableNames) {
                    try {
                        // Récupérer les informations de la table
                        const tableInfo = await this.databaseService.getTableInfo(serveurs, database, tableName);

                        // Nom du fichier DAO
                        const fileName = StringUtil.generatePhpFileName(tableName);
                        const filePath = path.join(outputFolder, fileName);

                        // Générer le contenu du DAO (après avoir défini filePath)
                        const daoContent = this.generateDaoContent(tableName, tableInfo, database, filePath);

                        // Vérifier si le fichier existe déjà
                        if (fs.existsSync(filePath)) {
                            if (options.mode === 'save') {
                                // Mode Sauvegarder: créer un backup et continuer
                                try {
                                    await this.createBackup(filePath);
                                    backupCount++;
                                } catch (backupError) {
                                    errors.push(`Erreur lors du backup pour ${tableName}: ${backupError instanceof Error ? backupError.message : 'Erreur inconnue'}`);
                                    skippedCount++;
                                    continue;
                                }
                            }
                            // Mode Écraser: ne pas créer de backup, continuer directement
                        }

                        // Écrire le fichier (nouveau ou remplacement)
                        fs.writeFileSync(filePath, daoContent, 'utf8');
                        generatedCount++;
                        generatedFiles.push(filePath);

                    } catch (error) {
                        errors.push(`Erreur pour la table ${tableName}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                    }
                }

                // Afficher le résultat
                this.showGenerationResult(generatedCount, skippedCount, errors, outputFolder, backupCount, generatedFiles);

            });
    }

    /**
     * Détermine et prépare le dossier de destination pour la génération des fichiers DAO.
     * Cette méthode gère plusieurs cas : utilisation du chemin par défaut du serveur,
     * détection automatique des projets WAMP, ou demande interactive à l'utilisateur.
     *
     * @private
     * @param {string} [suggestedPath] Chemin suggéré fourni par les options de génération (optionnel)
     * @param {string} [database] Nom de la base de données utilisé pour la détection automatique de projet (optionnel)
     * @param {string} [defaultDaoPath] Chemin par défaut configuré dans les paramètres du serveur (optionnel)
     * @return {(Promise<string | undefined>)} Promesse qui retourne le chemin absolu du dossier de destination ou undefined si annulé
     * @memberof DaoGeneratorService
     */
    private async getOutputFolder(suggestedPath?: string, database?: string, defaultDaoPath?: string): Promise<string | undefined> {
        // Si on a un defaultDaoPath et qu'il existe, l'utiliser directement
        if (defaultDaoPath && fs.existsSync(defaultDaoPath)) {
            return this.processSelectedPath(defaultDaoPath);
        }

        // Si suggestedPath est fourni et existe, l'utiliser
        if (suggestedPath && suggestedPath !== defaultDaoPath && fs.existsSync(suggestedPath)) {
            return this.processSelectedPath(suggestedPath);
        }

        // Chemin par défaut : D:\wamp64\www
        const defaultWampPath = DEFAULT_PATHS.WAMP_WWW;
        let defaultUri: vscode.Uri | undefined;

        // Déterminer le chemin par défaut pour la boîte de dialogue
        if (fs.existsSync(defaultWampPath)) {
            // Si le nom de la BDD correspond à un sous-dossier de www, l'ouvrir par défaut
            if (database) {
                // Essayer plusieurs variations du nom de la base de données
                const possibleFolderNames = [
                    database, // Nom exact de la BDD
                    database.toLowerCase(), // En minuscules
                    database.toUpperCase(), // En majuscules
                    // Enlever les préfixes communs (ex: rv_myproject -> myproject)
                    database.replace(/^[a-zA-Z]+_/, ''),
                    database.replace(/^[a-zA-Z]+_/, '').toLowerCase(),
                    database.replace(/^[a-zA-Z]+_/, '').toUpperCase()
                ];

                // Chercher le premier dossier qui existe
                for (const folderName of possibleFolderNames) {
                    const projectPath = path.join(defaultWampPath, folderName);
                    if (fs.existsSync(projectPath)) {
                        defaultUri = vscode.Uri.file(projectPath);
                        vscode.window.showInformationMessage(`Projet détecté automatiquement: ${folderName}`);
                        break;
                    }
                }

                // Si aucun projet trouvé, utiliser www par défaut
                if (!defaultUri) {
                    defaultUri = vscode.Uri.file(defaultWampPath);
                }
            } else {
                defaultUri = vscode.Uri.file(defaultWampPath);
            }
        } else {
            // Si wamp64 n'existe pas, essayer d'utiliser le workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                defaultUri = workspaceFolders[0].uri;
            }
            // Sinon, defaultUri reste undefined et la boîte s'ouvrira sans chemin spécifique
        }

        // Toujours demander à l'utilisateur de choisir le dossier de projet
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Sélectionner le projet pour les DAO',
            defaultUri: defaultUri,
            title: 'Choisir le dossier de projet pour générer les DAO'
        });

        if (result && result[0]) {
            return this.processSelectedPath(result[0].fsPath);
        }

        return undefined;
    }

    /**
     * Traite le chemin sélectionné pour créer automatiquement la structure de dossiers appropriée selon le type de projet.
     * Pour les projets WAMP (détectés par le chemin), crée la structure local/__classes/DAO.
     * Pour les autres projets, crée simplement un sous-dossier DAO.
     * 
     * @private
     * @param {string} selectedPath Chemin absolu du dossier sélectionné par l'utilisateur ou défini par défaut
     * @return {(string | undefined)} Chemin absolu final où générer les fichiers DAO, ou undefined en cas d'erreur de création
     * @memberof DaoGeneratorService
     */
    private processSelectedPath(selectedPath: string): string | undefined {
        // Vérifier si le dossier sélectionné est dans wamp64\www
        if (selectedPath.toLowerCase().startsWith(DEFAULT_PATHS.WAMP_WWW)) {
            // Créer la structure local/__classes/DAO pour les projets wamp
            const daoPath = path.join(selectedPath, ...DEFAULT_PATHS.LOCAL_CLASSES.split('/'));

            const result = ErrorHandler.handleSync(
                `création de la structure ${DEFAULT_PATHS.LOCAL_CLASSES.split('/').join('/')}`,
                () => {
                    // Créer le dossier DAO s'il n'existe pas
                    if (!fs.existsSync(daoPath)) {
                        fs.mkdirSync(daoPath, { recursive: true });
                        vscode.window.showInformationMessage(`Structure DAO créée: ${daoPath}`);
                    }
                    return daoPath;
                }
            );

            return result ?? undefined;
        } else {
            // Pour les autres projets, créer un sous-dossier DAO
            const daoPath = path.join(selectedPath, DEFAULT_PATHS.DAO_FOLDER);

            const result = ErrorHandler.handleSync(
                `création du dossier ${DEFAULT_PATHS.DAO_FOLDER}`,
                () => {
                    // Créer le dossier DAO s'il n'existe pas
                    if (!fs.existsSync(daoPath)) {
                        fs.mkdirSync(daoPath, { recursive: true });
                        vscode.window.showInformationMessage(`Dossier DAO créé: ${daoPath}`);
                    }
                    return daoPath;
                }
            );

            return result ?? selectedPath; // Retourner le dossier original si on ne peut pas créer le sous-dossier
        }
    }

    /**
     * Génère le code PHP complet d'un fichier DAO pour une table donnée.
     * Cette méthode assemble tous les composants : en-tête de classe, attributs, constructeur,
     * méthodes d'accès (getters/setters) et méthodes CRUD (Create, Read, Update, Delete).
     *
     * @private
     * @param {string} tableName Nom complet de la table en base de données (avec préfixe éventuel)
     * @param {TableInfo} tableInfo Métadonnées complètes de la table incluant colonnes, contraintes et index
     * @param {string} database Nom de la base de données contenant la table
     * @param {string} [filePath] Chemin du fichier DAO existant pour la gestion de version (optionnel)
     * @return {string} Code PHP complet prêt à être écrit dans un fichier .php
     * @memberof DaoGeneratorService
     */
    private generateDaoContent(tableName: string, tableInfo: TableInfo, database: string, filePath?: string): string {
        const className = StringUtil.generateDaoClassName(tableName);
        const attributes = this.generateAttributes(tableInfo.columns);
        const mappingArray = this.generateMappingArray(tableInfo.columns);
        const accessors = this.generateAccessors(tableInfo.columns);
        const crudMethods = this.generateCrudMethods(tableName, tableInfo.columns, database);
        const tableNameWithoutPrefix = StringUtil.removeTablePrefix(tableName);
        const userName = StringUtil.toPascalCase(os.userInfo().username);
        // Déterminer la version à utiliser
        let version: string = VERSION_PATTERN.INITIAL;
        if (filePath && fs.existsSync(filePath)) {
            version = this.getNextVersion(filePath);
        }

        return `<?php
/** 
 * Classe d'accès aux données -> table ${tableNameWithoutPrefix}
 * @version	${version}
 * @date	${DateUtil.formatForPhpDoc()}
 * @author	Généré automatiquement par ${userName} via PHP DAO Generator
 */

class ${className} extends Debug {
	//Déclaration et initialisation des variables
	private $_t;
${attributes}

    /**
     * @param int $id
     * @param bool $debug
     */
	public function __construct($id = 0, $debug = false) {
		// Creation d'un tableau cle/valeur pour automatiser le mapping Objet Relationnel
		$this->_t = array(
${mappingArray}
		);
		$this->setDebug($debug);
		if ($debug)
            Dump($this->_t, '$this->_t');

		$this->read($id, $debug);
	}

	//Accesseurs

${accessors}

	// Getter Setter pour t
	public function setT($value) { $this->_t = $value; }
	public function addT($key,$value) { $this->_t[$key] = $value; }
	public function delT($key) { unset($this->_t[$key]); }
	public function getT() { return $this->_t; }

${crudMethods}
}`;
    }

    /**
     * Génère les déclarations d'attributs privés de la classe DAO avec leur documentation PHPDoc.
     * Chaque attribut correspond à une colonne de la table et inclut le type PHP approprié
     * ainsi qu'un commentaire descriptif basé sur les métadonnées de la colonne.
     *
     * @private
     * @param {ColumnInfo[]} columns Tableau des métadonnées de toutes les colonnes de la table
     * @return {string} Code PHP des attributs privés avec documentation PHPDoc, prêt à insérer dans la classe
     * @memberof DaoGeneratorService
     */
    private generateAttributes(columns: ColumnInfo[]): string {
        return columns.map(column => {
            const phpType = this.mapSqlTypeToPhpType(column.type);
            const comment = this.generateColumnComment(column);

            return `    /**
     * ${comment}
     * @var ${phpType}
     */
    protected $_${column.name};`;
        }).join('\n\n');
    }

    /**
     * Génère le tableau de mapping objet-relationnel utilisé dans le constructeur du DAO.
     * Ce tableau associe chaque nom de colonne de la base de données à sa méthode setter correspondante,
     * permettant l'hydratation automatique de l'objet lors des opérations de lecture.
     *
     * @private
     * @param {ColumnInfo[]} columns Tableau des métadonnées de toutes les colonnes de la table
     * @return {string} Code PHP du tableau associatif formaté pour insertion dans le constructeur
     * @memberof DaoGeneratorService
     */
    private generateMappingArray(columns: ColumnInfo[]): string {
        return columns.map(column => {
            const setterName = 'set' + StringUtil.toPascalCase(column.name);
            return `			'${column.name}' => '${setterName}'`;
        }).join(',\n');
    }

    /**
     * Génère toutes les méthodes d'accès (getters et setters) pour chaque colonne de la table.
     * Ces méthodes permettent de lire et modifier de façon contrôlée les valeurs des attributs
     * de l'objet DAO en respectant les conventions de nommage PHP.
     *
     * @private
     * @param {ColumnInfo[]} columns Tableau des métadonnées de toutes les colonnes de la table
     * @return {string} Code PHP complet de toutes les méthodes getter/setter avec documentation PHPDoc
     * @memberof DaoGeneratorService
     */
    private generateAccessors(columns: ColumnInfo[]): string {
        return columns.map(column => {
            const methodName = StringUtil.toPascalCase(column.name);
            const phpType = this.mapSqlTypeToPhpType(column.type);
            const comment = this.generateColumnComment(column);

            return `    /**
     * ${comment}
     * @return ${phpType}
     */
    public function get${methodName}() { return $this->_${column.name}; }

    /**
     * ${comment}
     * @param ${phpType} $value
     * @return void
     */
    public function set${methodName}($value) { $this->_${column.name}=$value; }`;
        }).join('\n\n');
    }

    /**
     * Génère toutes les méthodes CRUD (Create, Read, Update, Delete) PHP pour manipuler les données de la table.
     * Ces méthodes incluent : read() pour charger un enregistrement, insert() pour créer un nouvel enregistrement,
     * update() pour modifier un enregistrement existant, et delete() pour supprimer un enregistrement.
     *
     * @private
     * @param {string} tableName Nom complet de la table en base de données (avec préfixe éventuel)
     * @param {ColumnInfo[]} columns Tableau des métadonnées de toutes les colonnes de la table
     * @param {string} database Nom de la base de données (utilisé pour les commentaires et la documentation)
     * @return {string} Code PHP complet des quatre méthodes CRUD avec gestion d'erreurs et documentation
     * @memberof DaoGeneratorService
     */
    private generateCrudMethods(tableName: string, columns: ColumnInfo[], database: string): string {
        const tableNameWithoutPrefix = StringUtil.removeTablePrefix(tableName);
        const primaryKey = this.findPrimaryKey(columns);
        const pkName = primaryKey ? primaryKey.name : 'id';
        const pkMethodName = StringUtil.toPascalCase(pkName);

        return `    /**
	 * Lecture d'un enregistrement et transfert dans l'objet
     * @param int $id ID de l'enregistrement
     * @return void
     */
	public function read($id = NULL) {
		global $_dbBridge;

		if ($id !== null) $this->set${pkMethodName}($id);

		if ($this->get${pkMethodName}() > 0) {
			// Recuperation des autres champs de la table
			$tRetour = array();
			$strSQL = 'SELECT * FROM ' . PREFIX_SESSION . '${tableNameWithoutPrefix} WHERE ${pkName} = ' . $this->get${pkMethodName}();
			$tRetour = $_dbBridge->fetchRow($strSQL);
			if ($this->getDebug())
                Dump($tRetour, $strSQL);

			foreach($this->_t as $key => $value) {
				// On teste pour voir si la cle existe ds le tableau resultant de la requête
				if (array_key_exists($key, $this->_t))
					$this->$value($tRetour[$key]);
			}
		}
	}

    /**
     * Écriture d'un enregistrement à partir du contenu de l'objet
     * @return bool True si succès, false sinon
     */
	public function insert() {
		global $_dbBridge;

		$bind = array();
		foreach($this->_t as $key => $value) {
			// On teste pour voir si la cle existe ds le tableau resultant de la requête
			if (array_key_exists($key, $this->_t) && $key != '${pkName}') {
				$function = 'get'.substr($value, 3);
				$bind[$key] = $this->$function();
			}
		}

		try {
			$_dbBridge->insert(PREFIX_SESSION . '${tableNameWithoutPrefix}', $bind);
			return $_dbBridge->lastInsertId();
		}catch (Exception $e) {
			if ($this->getDebug()) 
                Dump($e->getMessage(), 'Exception');
			return false;
		}
	}


    /**
     * Mise à jour d'un enregistrement à partir du contenu de l'objet
     * @return bool True si succès, false sinon
     */
    public function update() {
		global $_dbBridge;

		$bind = array();
		foreach ($this->_t as $key => $value) {
			$function = 'get' . substr($value, 3);
			$bind[$key] = $this->$function();
		}
		return $_dbBridge->update(PREFIX_SESSION . '${tableNameWithoutPrefix}', $bind, '${pkName} = ' . $bind['${pkName}']);
	}

    /**
     * Suppression d'un enregistrement
     * @return bool True si succès, false sinon
     */
	public function delete($id=NULL) {
		global $_dbBridge;

		if ($id !== null) $this->set${pkMethodName}($id);
		if ($this->get${pkMethodName}() > 0)
			return $_dbBridge->delete(PREFIX_SESSION . '${tableNameWithoutPrefix}', '${pkName} = ' . $this->get${pkMethodName}());
	}`;
    }

    /**
     * Génère un commentaire descriptif complet pour une colonne de base de données.
     * Le commentaire inclut le nom, le type SQL, les contraintes (clé primaire, unique, etc.),
     * la nullabilité, la valeur par défaut et les propriétés spéciales (auto_increment, etc.).
     *
     * @private
     * @param {ColumnInfo} column Métadonnées complètes de la colonne (nom, type, contraintes, valeur par défaut, etc.)
     * @return {string} Commentaire descriptif formaté prêt à être inséré dans la documentation PHPDoc
     * @memberof DaoGeneratorService
     */
    private generateColumnComment(column: ColumnInfo): string {
        let comment = `${column.name} (${column.type})`;

        if (column.key === 'PRI') {
            comment += ' - Clé primaire';
        } else if (column.key === 'UNI') {
            comment += ' - Unique';
        } else if (column.key === 'MUL') {
            comment += ' - Index multiple';
        }

        if (!column.nullable) {
            comment += ' - Non null';
        }

        if (column.default !== null) {
            comment += ` - Défaut: ${column.default}`;
        }

        if (column.extra) {
            comment += ` - ${column.extra}`;
        }

        return comment;
    }

    /**
     * Convertit les types de données SQL en types PHP équivalents pour les annotations PHPDoc.
     * Cette fonction garantit que les commentaires générés utilisent les types PHP corrects
     * pour améliorer l'autocomplétion et la validation des IDE.
     *
     * @private
     * @param {string} sqlType Type de données SQL complet (ex: "VARCHAR(255)", "INT(11)", "DECIMAL(10,2)")
     * @return {string} Type PHP correspondant (int, float, bool, string) pour les annotations @var et @param
     * @memberof DaoGeneratorService
     */
    private mapSqlTypeToPhpType(sqlType: string): string {
        const type = sqlType.toLowerCase();

        if (type.includes('int') || type.includes('tinyint') || type.includes('smallint') ||
            type.includes('mediumint') || type.includes('bigint')) {
            return 'int';
        }

        if (type.includes('decimal') || type.includes('float') || type.includes('double') ||
            type.includes('real') || type.includes('numeric')) {
            return 'float';
        }

        if (type.includes('bool') || type.includes('boolean')) {
            return 'bool';
        }

        if (type.includes('date') || type.includes('time') || type.includes('year')) {
            return 'string';
        }

        // Par défaut, string
        return 'string';
    }

    /**
     * Recherche et retourne la colonne définie comme clé primaire dans la table.
     * Cette information est cruciale pour la génération des méthodes CRUD qui ont besoin
     * d'identifier de façon unique les enregistrements.
     *
     * @private
     * @param {ColumnInfo[]} columns Tableau complet des métadonnées de toutes les colonnes de la table
     * @return {(ColumnInfo | null)} Objet ColumnInfo de la clé primaire trouvée, ou null si aucune clé primaire n'est définie
     * @memberof DaoGeneratorService
     */
    private findPrimaryKey(columns: ColumnInfo[]): ColumnInfo | null {
        return columns.find(col => col.key === 'PRI') || null;
    }

    /**
     * Extrait et retourne la version actuelle d'un fichier DAO existant en analysant son en-tête PHPDoc.
     * Cette méthode recherche la balise @version dans le commentaire d'en-tête pour déterminer
     * le numéro de version actuel avant de générer la version suivante.
     *
     * @private
     * @param {string} filePath Chemin absolu vers le fichier DAO existant à analyser
     * @return {string} Numéro de version actuelle au format "X.YY" (ex: "1.00"), ou version initiale par défaut si non trouvée
     * @memberof DaoGeneratorService
     */
    private getCurrentVersion(filePath: string): string {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const versionMatch = content.match(/@version\s+(\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : VERSION_PATTERN.INITIAL;
        } catch (error) {
            return VERSION_PATTERN.INITIAL;
        }
    }

    /**
     * Calcule et retourne la version suivante selon le schéma de versioning personnalisé.
     * Le pattern utilisé incrémente la partie mineure de 10 : 1.00 → 1.10 → 1.20 → 1.30, etc.
     * Cette approche permet de maintenir un historique clair des modifications automatiques.
     *
     * @private
     * @param {string} filePath Chemin absolu vers le fichier DAO existant pour lequel calculer la version suivante
     * @return {string} Nouveau numéro de version incrémenté au format "X.YY" (ex: "1.10" si version actuelle est "1.00")
     * @memberof DaoGeneratorService
     */
    private getNextVersion(filePath: string): string {
        const currentVersion = this.getCurrentVersion(filePath);
        const [major, minor] = currentVersion.split('.').map(Number);

        // Incrémenter la partie mineure de 10
        const newMinor = minor + VERSION_PATTERN.INCREMENT;

        return `${major}.${newMinor.toString().padStart(2, '0')}`;
    }

    /**
     * Crée une copie de sauvegarde horodatée d'un fichier DAO existant avant de le remplacer.
     * Le backup est stocké dans un sous-dossier 'backup' avec un nom incluant la date/heure
     * et un en-tête explicatif pour faciliter la récupération en cas de problème.
     *
     * @private
     * @param {string} filePath Chemin absolu vers le fichier DAO existant à sauvegarder
     * @return {Promise<void>} Promesse qui se résout une fois la sauvegarde créée avec succès
     * @memberof DaoGeneratorService
     */
    private async createBackup(filePath: string): Promise<void> {
        if (!fs.existsSync(filePath)) {
            return; // Le fichier n'existe pas, pas besoin de backup
        }

        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath, FILE_EXTENSIONS.PHP);
        const timestamp = DateUtil.formatFrenchDateTime();

        // Créer le dossier backup s'il n'existe pas
        const backupDir = path.join(fileDir, 'backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Nom du fichier de backup
        const backupFileName = `${fileName}_backup_${timestamp}${FILE_EXTENSIONS.PHP}`;
        const backupFilePath = path.join(backupDir, backupFileName);

        try {
            // Copier le fichier existant vers le backup
            const originalContent = fs.readFileSync(filePath, 'utf8');

            // Ajouter un commentaire en en-tête du backup
            const backupContent = `<?php
/**
 * BACKUP automatique créé le ${new Date().toLocaleString('fr-FR')}
 * Fichier original: ${path.basename(filePath)}
 * Généré par PHP DAO Generator Extension
 */

${originalContent.replace(/^<\?php\s*/, '')}`;

            fs.writeFileSync(backupFilePath, backupContent, 'utf8');

        } catch (error) {
            throw new Error(`Impossible de créer le backup: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
    }

    /**
     * Affiche un résumé détaillé de la génération DAO avec statistiques et actions possibles.
     * Cette méthode présente le nombre de fichiers créés, ignorés, les erreurs rencontrées
     * et propose à l'utilisateur d'ouvrir le dossier de destination ou des fichiers spécifiques.
     *
     * @private
     * @param {number} generatedCount Nombre total de fichiers DAO générés avec succès
     * @param {number} skippedCount Nombre de fichiers ignorés (non générés pour diverses raisons)
     * @param {string[]} errors Tableau des messages d'erreur rencontrés pendant la génération
     * @param {string} [outputFolder] Chemin absolu du dossier contenant les fichiers générés (optionnel)
     * @param {number} [backupCount=0] Nombre de fichiers de sauvegarde créés (par défaut 0)
     * @param {string[]} [generatedFiles=[]] Liste des chemins absolus des fichiers générés pour actions rapides (par défaut tableau vide)
     * @memberof DaoGeneratorService
     */
    private showGenerationResult(generatedCount: number, skippedCount: number, errors: string[], outputFolder?: string, backupCount: number = 0, generatedFiles: string[] = []): void {
        let message = `Génération terminée: ${generatedCount} fichier(s) créé(s)`;

        if (backupCount > 0) {
            message += `, ${backupCount} backup(s) créé(s)`;
        }

        if (skippedCount > 0) {
            message += `, ${skippedCount} fichier(s) ignoré(s) (erreurs)`;
        }

        if (outputFolder) {
            message += `\nDossier de destination: ${outputFolder}`;
            if (backupCount > 0) {
                message += `\nDossier des backups: ${path.join(outputFolder, 'backup')}`;
            }
        }

        if (errors.length > 0) {
            message += `\n${errors.length} erreur(s) rencontrée(s)`;
            vscode.window.showWarningMessage(message);

            // Afficher les erreurs dans le canal de sortie
            const outputChannel = vscode.window.createOutputChannel('DAO Generator');
            outputChannel.show();
            outputChannel.appendLine('Erreurs lors de la génération:');
            errors.forEach(error => outputChannel.appendLine('- ' + error));
            if (outputFolder) {
                outputChannel.appendLine(`\nDossier de destination: ${outputFolder}`);
                if (backupCount > 0) {
                    outputChannel.appendLine(`Dossier des backups: ${path.join(outputFolder, 'backup')}`);
                }
            }
        }
        // Ne plus afficher le message de base ici pour éviter le conflit avec le message avec boutons

        // Proposer d'ouvrir le dossier de destination
        if (outputFolder && generatedCount > 0) {
            const actions = ['Ouvrir le dossier'];
            if (backupCount > 0) {
                actions.push('Voir les backups');
            }

            // Message avec boutons d'action
            let actionMessage = `${generatedCount} fichier(s) DAO créé(s) avec succès!`;
            if (backupCount > 0) {
                actionMessage += ` (${backupCount} backup(s) créé(s))`;
            }
            if (errors.length > 0) {
                actionMessage += ` | ${errors.length} erreur(s)`;
            }

            vscode.window.showInformationMessage(actionMessage, ...actions).then(selection => {
                if (selection === 'Ouvrir le dossier') {
                    // Si on a des fichiers générés, sélectionner le premier fichier
                    if (generatedFiles.length > 0) {
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(generatedFiles[0]));
                    } else {
                        // Sinon ouvrir le dossier
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputFolder));
                    }
                } else if (selection === 'Voir les backups') {
                    const backupFolder = path.join(outputFolder, 'backup');
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(backupFolder));
                }
            });
        } else if (outputFolder && generatedCount === 0 && errors.length === 0) {
            // Cas où il n'y a rien à générer
            vscode.window.showInformationMessage('Aucun fichier DAO n\'a été généré.');
        } else {
            // Afficher le message de base uniquement si on ne peut pas afficher les boutons d'action
            if (errors.length === 0) {
                vscode.window.showInformationMessage(message);
            }
        }
    }
}
