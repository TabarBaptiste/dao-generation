import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection, TableInfo, ColumnInfo } from '../types/Connection';
import { DatabaseService } from './DatabaseService';

interface DaoGenerationOptions {
    mode: 'save' | 'overwrite';
    outputPath?: string;
}

export class DaoGeneratorService {
    constructor(private databaseService: DatabaseService) {}

    public async generateDaoFiles(
        connection: DatabaseConnection,
        database: string,
        tableNames: string[],
        options: DaoGenerationOptions
    ): Promise<void> {
        try {
            // Demander le dossier de destination
            const outputFolder = await this.getOutputFolder(options.outputPath);
            if (!outputFolder) {
                vscode.window.showWarningMessage('Génération annulée : aucun dossier sélectionné.');
                return;
            }

            // Afficher un message de confirmation avec le chemin de destination
            vscode.window.showInformationMessage(`Génération des DAO dans: ${outputFolder}`);

            let generatedCount = 0;
            let skippedCount = 0;
            const errors: string[] = [];

            for (const tableName of tableNames) {
                try {
                    // Récupérer les informations de la table
                    const tableInfo = await this.databaseService.getTableInfo(connection, database, tableName);
                    
                    // Générer le contenu du DAO
                    const daoContent = this.generateDaoContent(tableName, tableInfo, database);
                    
                    // Nom du fichier DAO
                    const fileName = 'DAO' + this.toPascalCase(tableName) + '.php';
                    const filePath = path.join(outputFolder, fileName);
                    
                    // Vérifier si le fichier existe déjà
                    if (fs.existsSync(filePath) && options.mode === 'save') {
                        skippedCount++;
                        continue;
                    }
                    
                    // Écrire le fichier
                    fs.writeFileSync(filePath, daoContent, 'utf8');
                    generatedCount++;
                    
                } catch (error) {
                    errors.push(`Erreur pour la table ${tableName}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                }
            }

            // Afficher le résultat
            this.showGenerationResult(generatedCount, skippedCount, errors, outputFolder);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur lors de la génération: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
    }

    private async getOutputFolder(suggestedPath?: string): Promise<string | undefined> {
        if (suggestedPath && fs.existsSync(suggestedPath)) {
            return suggestedPath;
        }

        // Vérifier d'abord si on est déjà dans un workspace wamp64
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            
            // Vérifier si le workspace est sous D:\wamp64\www
            if (workspaceRoot.toLowerCase().startsWith('d:\\wamp64\\www\\')) {
                const daoPath = path.join(workspaceRoot, 'local', '__classes', 'DAO');
                
                try {
                    // Créer le dossier DAO s'il n'existe pas
                    if (!fs.existsSync(daoPath)) {
                        fs.mkdirSync(daoPath, { recursive: true });
                        vscode.window.showInformationMessage(`Dossier créé automatiquement: ${daoPath}`);
                    }
                    
                    return daoPath;
                } catch (error) {
                    vscode.window.showErrorMessage(`Erreur lors de la création du dossier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                }
            }
        }

        // Chemin par défaut : D:\wamp64\www
        const defaultWampPath = 'D:\\wamp64\\www';
        
        // Vérifier si le chemin wamp existe
        if (fs.existsSync(defaultWampPath)) {
            // Demander à l'utilisateur de choisir un sous-dossier dans wamp64\www
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Sélectionner le projet dans wamp64\\www',
                defaultUri: vscode.Uri.file(defaultWampPath),
                title: 'Choisir le dossier de projet pour les DAO'
            });

            if (result && result[0]) {
                const selectedPath = result[0].fsPath;
                
                // Créer la structure local/__classes/DAO
                const daoPath = path.join(selectedPath, 'local', '__classes', 'DAO');
                
                try {
                    // Créer le dossier DAO s'il n'existe pas
                    if (!fs.existsSync(daoPath)) {
                        fs.mkdirSync(daoPath, { recursive: true });
                        vscode.window.showInformationMessage(`Dossier créé: ${daoPath}`);
                    }
                    
                    return daoPath;
                } catch (error) {
                    vscode.window.showErrorMessage(`Erreur lors de la création du dossier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
                }
            }
        } else {
            // Si wamp64 n'existe pas, utiliser l'ancien comportement
            vscode.window.showWarningMessage('Le dossier D:\\wamp64\\www n\'existe pas. Utilisation du workspace ou sélection manuelle.');
            
            // Utiliser le workspace ouvert ou demander à l'utilisateur
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const daoFolder = path.join(workspaceRoot, 'dao');
                
                // Créer le dossier dao s'il n'existe pas
                if (!fs.existsSync(daoFolder)) {
                    fs.mkdirSync(daoFolder, { recursive: true });
                }
                
                return daoFolder;
            }

            // Sinon, demander à l'utilisateur de choisir un dossier
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Sélectionner le dossier de destination'
            });

            return result && result[0] ? result[0].fsPath : undefined;
        }

        return undefined;
    }

    private generateDaoContent(tableName: string, tableInfo: TableInfo, database: string): string {
        const className = this.toPascalCase(tableName) + 'DAO';
        const attributes = this.generateAttributes(tableInfo.columns);
        const mappingArray = this.generateMappingArray(tableInfo.columns);
        const constructor = this.generateConstructor(tableInfo.columns);
        const accessors = this.generateAccessors(tableInfo.columns);
        const crudMethods = this.generateCrudMethods(tableName, tableInfo.columns, database);
        const primaryKey = this.findPrimaryKey(tableInfo.columns);

        return `<?php

/**
 * DAO pour la table ${tableName}
 * Générée automatiquement par PHP DAO Generator
 * Base de données: ${database}
 * Table: ${tableName}
 */
class ${className} {
    // Mapping des attributs pour l'accès aux données
    private $_t;
    
${attributes}

    /**
     * Constructeur
     * @param int $id ID de l'enregistrement à charger (0 pour un nouvel objet)
     * @param bool $debug Mode debug pour affichage des requêtes SQL
     */
    public function __construct($id = 0, $debug = false) {
        $this->_t = ${mappingArray};
        
        if ($id > 0) {
            $this->read($id);
        }
    }

${accessors}

${crudMethods}

    /**
     * Méthode privée pour exécuter une requête
     * @param string $sql Requête SQL
     * @param array $params Paramètres de la requête
     * @param bool $debug Mode debug
     * @return mixed Résultat de la requête
     */
    private function executeQuery($sql, $params = [], $debug = false) {
        try {
            // TODO: Adapter selon votre système de base de données
            // Exemple avec PDO (à adapter selon vos besoins)
            $pdo = $this->getConnection();
            
            if ($debug) {
                error_log("SQL: " . $sql);
                error_log("Params: " . print_r($params, true));
            }
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            return $stmt;
        } catch (Exception $e) {
            if ($debug) {
                error_log("Erreur SQL: " . $e->getMessage());
            }
            throw $e;
        }
    }

    /**
     * Méthode pour obtenir la connexion à la base de données
     * TODO: À implémenter selon votre architecture
     * @return PDO
     */
    private function getConnection() {
        // TODO: Retourner votre connexion PDO
        // Exemple:
        // return DatabaseManager::getInstance()->getConnection();
        throw new Exception("Méthode getConnection() à implémenter");
    }
}

?>`;
    }

    private generateAttributes(columns: ColumnInfo[]): string {
        return columns.map(column => {
            const phpType = this.mapSqlTypeToPhpType(column.type);
            const comment = this.generateColumnComment(column);
            
            return `    /**
     * ${comment}
     * @var ${phpType}
     */
    protected $${column.name};`;
        }).join('\n\n');
    }

    private generateMappingArray(columns: ColumnInfo[]): string {
        const mappings = columns.map(column => {
            return `            '${column.name}' => '${column.name}'`;
        });
        
        return `[\n${mappings.join(',\n')}\n        ]`;
    }

    private generateConstructor(columns: ColumnInfo[]): string {
        // Le constructeur est déjà généré dans generateDaoContent
        return '';
    }

    private generateAccessors(columns: ColumnInfo[]): string {
        return columns.map(column => {
            const methodName = this.toPascalCase(column.name);
            const phpType = this.mapSqlTypeToPhpType(column.type);
            const comment = this.generateColumnComment(column);
            
            return `    /**
     * Getter pour ${column.name}
     * ${comment}
     * @return ${phpType}
     */
    public function get${methodName}() {
        return $this->${column.name};
    }

    /**
     * Setter pour ${column.name}
     * ${comment}
     * @param ${phpType} $value
     * @return void
     */
    public function set${methodName}($value) {
        $this->${column.name} = $value;
    }`;
        }).join('\n\n');
    }

    private generateCrudMethods(tableName: string, columns: ColumnInfo[], database: string): string {
        const primaryKey = this.findPrimaryKey(columns);
        const pkName = primaryKey ? primaryKey.name : 'id';
        
        const columnsForInsert = columns.filter(col => col.extra !== 'auto_increment');
        const insertColumns = columnsForInsert.map(col => col.name).join(', ');
        const insertPlaceholders = columnsForInsert.map(() => '?').join(', ');
        const insertValues = columnsForInsert.map(col => `$this->${col.name}`).join(', ');
        
        const updateSet = columns
            .filter(col => col.key !== 'PRI')
            .map(col => `${col.name} = ?`)
            .join(', ');
        const updateValues = columns
            .filter(col => col.key !== 'PRI')
            .map(col => `$this->${col.name}`)
            .join(', ');

        return `    /**
     * Lire un enregistrement par son ID
     * @param int $id ID de l'enregistrement
     * @return bool True si trouvé, false sinon
     */
    public function read($id) {
        $sql = "SELECT * FROM \`${database}\`.\`${tableName}\` WHERE \`${pkName}\` = ?";
        $stmt = $this->executeQuery($sql, [$id]);
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
${this.generateReadAssignments(columns)}
            return true;
        }
        
        return false;
    }

    /**
     * Insérer un nouvel enregistrement
     * @return bool True si succès, false sinon
     */
    public function insert() {
        $sql = "INSERT INTO \`${database}\`.\`${tableName}\` (${insertColumns}) VALUES (${insertPlaceholders})";
        $stmt = $this->executeQuery($sql, [${insertValues}]);
        
        if ($stmt->rowCount() > 0) {
${primaryKey && primaryKey.extra === 'auto_increment' ? `            $this->${pkName} = $this->getConnection()->lastInsertId();` : ''}
            return true;
        }
        
        return false;
    }

    /**
     * Mettre à jour l'enregistrement
     * @return bool True si succès, false sinon
     */
    public function update() {
        $sql = "UPDATE \`${database}\`.\`${tableName}\` SET ${updateSet} WHERE \`${pkName}\` = ?";
        $stmt = $this->executeQuery($sql, [${updateValues}, $this->${pkName}]);
        
        return $stmt->rowCount() > 0;
    }

    /**
     * Supprimer un enregistrement
     * @param int $id ID de l'enregistrement à supprimer
     * @return bool True si succès, false sinon
     */
    public function delete($id) {
        $sql = "DELETE FROM \`${database}\`.\`${tableName}\` WHERE \`${pkName}\` = ?";
        $stmt = $this->executeQuery($sql, [$id]);
        
        return $stmt->rowCount() > 0;
    }

    /**
     * Supprimer l'enregistrement courant
     * @return bool True si succès, false sinon
     */
    public function deleteThis() {
        if ($this->${pkName}) {
            return $this->delete($this->${pkName});
        }
        return false;
    }

    /**
     * Lister tous les enregistrements
     * @param string $orderBy Champ pour l'ordre (optionnel)
     * @param string $direction ASC ou DESC (optionnel)
     * @param int $limit Limite de résultats (optionnel)
     * @return array Tableau d'objets ${this.toPascalCase(tableName)}DAO
     */
    public static function findAll($orderBy = null, $direction = 'ASC', $limit = null) {
        $sql = "SELECT * FROM \`${database}\`.\`${tableName}\`";
        
        if ($orderBy) {
            $sql .= " ORDER BY \`$orderBy\` $direction";
        }
        
        if ($limit) {
            $sql .= " LIMIT $limit";
        }
        
        // TODO: Adapter selon votre architecture pour les méthodes statiques
        $pdo = self::getStaticConnection();
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        
        $results = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $obj = new self();
${this.generateFindAllAssignments(columns)}
            $results[] = $obj;
        }
        
        return $results;
    }

    /**
     * Méthode statique pour obtenir la connexion à la base de données
     * TODO: À implémenter selon votre architecture
     * @return PDO
     */
    private static function getStaticConnection() {
        // TODO: Retourner votre connexion PDO statique
        // Exemple:
        // return DatabaseManager::getInstance()->getConnection();
        throw new Exception("Méthode getStaticConnection() à implémenter");
    }`;
    }

    private generateReadAssignments(columns: ColumnInfo[]): string {
        return columns.map(column => {
            return `            $this->${column.name} = $row['${column.name}'];`;
        }).join('\n');
    }

    private generateFindAllAssignments(columns: ColumnInfo[]): string {
        return columns.map(column => {
            return `            $obj->${column.name} = $row['${column.name}'];`;
        }).join('\n');
    }

    private generateColumnComment(column: ColumnInfo): string {
        let comment = `Colonne ${column.name} (${column.type})`;
        
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

    private findPrimaryKey(columns: ColumnInfo[]): ColumnInfo | null {
        return columns.find(col => col.key === 'PRI') || null;
    }

    private toPascalCase(str: string): string {
        return str.replace(/(^\w|_\w)/g, (match) => match.replace('_', '').toUpperCase());
    }

    private showGenerationResult(generatedCount: number, skippedCount: number, errors: string[], outputFolder?: string): void {
        let message = `Génération terminée: ${generatedCount} fichier(s) créé(s)`;
        
        if (skippedCount > 0) {
            message += `, ${skippedCount} fichier(s) ignoré(s) (déjà existants)`;
        }
        
        if (outputFolder) {
            message += `\nDossier de destination: ${outputFolder}`;
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
            }
        } else {
            vscode.window.showInformationMessage(message);
        }
        
        // Proposer d'ouvrir le dossier de destination
        if (outputFolder && generatedCount > 0) {
            vscode.window.showInformationMessage(
                `${generatedCount} fichier(s) DAO créé(s) avec succès!`,
                'Ouvrir le dossier'
            ).then(selection => {
                if (selection === 'Ouvrir le dossier') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputFolder));
                }
            });
        }
    }
}
