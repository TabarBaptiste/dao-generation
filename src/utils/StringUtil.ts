import { FILE_EXTENSIONS } from '../constants/AppConstants';

/**
 * Fonctions utilitaires de manipulation de chaînes pour un traitement textuel cohérent dans l'application.
 * Centralise toutes les opérations courantes sur les chaînes pour éliminer les duplications
 * et garantir la cohérence des conventions de nommage.
 */
export class StringUtil {
    /**
     * Convertit n'importe quelle chaîne en convention PascalCase pour les noms de classes et de méthodes.
     * Cette méthode transforme les chaînes en underscore, séparées par des espaces ou en casse mixte
     * en un format PascalCase où chaque mot commence par une majuscule.
     *
     * @static
     * @param {string} str Chaîne d'entrée dans un format quelconque (underscore_case, séparée par des espaces, casse mixte)
     * @return {string} Chaîne formatée en PascalCase adaptée aux noms de classes et de méthodes
     * @memberof StringUtil
     */
    static toPascalCase(str: string): string {
        return str.replace(/(^\w|_\w)/g, (match) => match.replace('_', '').toUpperCase());
    }

    /**
     * Convertit n'importe quelle chaîne en convention camelCase pour les noms de variables et propriétés.
     * Cette méthode convertit d'abord en PascalCase puis met en minuscule le premier caractère,
     * produisant le format camelCase standard utilisé en JavaScript/TypeScript.
     *
     * @static
     * @param {string} str Chaîne d'entrée dans un format quelconque (underscore_case, séparée par des espaces, casse mixte)
     * @return {string} Chaîne formatée en camelCase adaptée aux noms de variables et propriétés
     * @memberof StringUtil
     */
    static toCamelCase(str: string): string {
        const pascalCase = this.toPascalCase(str);
        return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
    }

    /**
     * Removes common database table prefixes to extract the clean table name for code generation.
     * This method strips prefixes like "rv_", "app_", etc. that are commonly used in database naming
     * conventions but not desired in generated class names.
     *
     * @static
     * @param {string} tableName Full database table name potentially containing a prefix
     * @return {string} Clean table name without prefix, suitable for class generation
     * @memberof StringUtil
     */
    static removeTablePrefix(tableName: string): string {
        return tableName.replace(/^[^_]+_/, '');
    }

    /**
     * Generates a proper DAO class name from a database table name following naming conventions.
     * This method removes table prefixes, converts to PascalCase, and adds the "DAO" prefix
     * to create consistent class names like "DAOUsers" from "rv_users".
     *
     * @static
     * @param {string} tableName Original database table name (may include prefixes and underscores)
     * @return {string} Properly formatted DAO class name following PHP naming conventions
     * @memberof StringUtil
     */
    static generateDaoClassName(tableName: string): string {
        const nameWithoutPrefix = this.removeTablePrefix(tableName);
        return 'DAO' + this.toPascalCase(nameWithoutPrefix);
    }

    /**
     * Generates a complete PHP filename with proper extension from a database table name.
     * This method combines DAO class name generation with file extension to create
     * complete filenames ready for filesystem operations.
     *
     * @static
     * @param {string} tableName Database table name to transform into filename
     * @return {string} Complete PHP filename with .php extension (e.g., "DAOUsers.php")
     * @memberof StringUtil
     */
    static generatePhpFileName(tableName: string): string {
        return this.generateDaoClassName(tableName) + FILE_EXTENSIONS.PHP;
    }

    /**
     * Sanitizes filenames by replacing invalid filesystem characters with safe alternatives.
     * This method ensures filenames are compatible with all major operating systems
     * by replacing problematic characters with underscores.
     *
     * @static
     * @param {string} fileName Raw filename that may contain invalid characters
     * @return {string} Sanitized filename safe for use on Windows, macOS, and Linux filesystems
     * @memberof StringUtil
     */
    static sanitizeFileName(fileName: string): string {
        return fileName.replace(/[<>:"/\\|?*]/g, '_');
    }

    /**
     * Truncates long strings to a specified maximum length with ellipsis indicator.
     * This method preserves readability while preventing UI overflow by adding "..."
     * to indicate truncated content, commonly used in tables and lists.
     *
     * @static
     * @param {string} str Original string that may be too long for display
     * @param {number} maxLength Maximum allowed length including the ellipsis characters
     * @return {string} Truncated string with "..." suffix if original was too long, or original string if within limit
     * @memberof StringUtil
     */
    static truncate(str: string, maxLength: number): string {
        if (str.length <= maxLength) {
            return str;
        }
        return str.slice(0, maxLength - 3) + '...';
    }

    /**
     * Checks if a string is empty, null, undefined, or contains only whitespace characters.
     * This comprehensive validation method handles all common "empty" scenarios,
     * providing a single point of truth for string emptiness validation.
     *
     * @static
     * @param {(string | null | undefined)} str String value to validate (may be null or undefined)
     * @return {boolean} true if the string is empty, null, undefined, or only whitespace; false if it contains meaningful content
     * @memberof StringUtil
     */
    static isEmpty(str: string | null | undefined): boolean {
        return !str || str.trim().length === 0;
    }
}