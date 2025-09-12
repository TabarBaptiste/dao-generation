import { FILE_EXTENSIONS } from '../constants/AppConstants';

/**
 * String manipulation utility functions
 * Centralizes common string operations to eliminate duplication
 */
export class StringUtil {
    /**
     * Converts string to PascalCase
     * @param str String to convert
     * @returns PascalCase string
     */
    static toPascalCase(str: string): string {
        return str.replace(/(^\w|_\w)/g, (match) => match.replace('_', '').toUpperCase());
    }

    /**
     * Converts string to camelCase
     * @param str String to convert
     * @returns camelCase string
     */
    static toCamelCase(str: string): string {
        const pascalCase = this.toPascalCase(str);
        return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
    }

    /**
     * Removes prefix from table name (e.g., rv_users -> users)
     * @param tableName Table name with potential prefix
     * @returns Table name without prefix
     */
    static removeTablePrefix(tableName: string): string {
        return tableName.replace(/^[^_]+_/, '');
    }

    /**
     * Generates DAO class name from table name
     * @param tableName Database table name
     * @returns DAO class name
     */
    static generateDaoClassName(tableName: string): string {
        const nameWithoutPrefix = this.removeTablePrefix(tableName);
        return 'DAO' + this.toPascalCase(nameWithoutPrefix);
    }

    /**
     * Generates PHP file name from table name
     * @param tableName Database table name
     * @returns PHP file name
     */
    static generatePhpFileName(tableName: string): string {
        return this.generateDaoClassName(tableName) + FILE_EXTENSIONS.PHP;
    }

    /**
     * Sanitizes file name by removing invalid characters
     * @param fileName File name to sanitize
     * @returns Sanitized file name
     */
    static sanitizeFileName(fileName: string): string {
        return fileName.replace(/[<>:"/\\|?*]/g, '_');
    }

    /**
     * Truncates string to specified length with ellipsis
     * @param str String to truncate
     * @param maxLength Maximum length
     * @returns Truncated string
     */
    static truncate(str: string, maxLength: number): string {
        if (str.length <= maxLength) {
            return str;
        }
        return str.slice(0, maxLength - 3) + '...';
    }

    /**
     * Checks if string is empty or only whitespace
     * @param str String to check
     * @returns True if empty or whitespace
     */
    static isEmpty(str: string | null | undefined): boolean {
        return !str || str.trim().length === 0;
    }
}