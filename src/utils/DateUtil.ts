/**
 * Date and time utility functions
 * Centralizes date formatting operations
 */
export class DateUtil {
    /**
     * Formats date for French locale (DD-MM-YYYY HH:mm:ss)
     * @param date Date to format
     * @returns Formatted date string
     */
    static formatFrenchDateTime(date: Date = new Date()): string {
        return date.toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/[\/\s:]/g, '-');
    }

    /**
     * Formats date for file names (YYYY-MM-DD_HH-mm-ss)
     * @param date Date to format
     * @returns File-safe date string
     */
    static formatForFileName(date: Date = new Date()): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
    }

    /**
     * Formats date for ISO 8601 date only (YYYY-MM-DD)
     * @param date Date to format
     * @returns ISO date string
     */
    static formatIsoDate(date: Date = new Date()): string {
        return date.toISOString().slice(0, 10);
    }

    /**
     * Formats date for PHP documentation headers
     * @param date Date to format
     * @returns Formatted date for PHP docs
     */
    static formatForPhpDoc(date: Date = new Date()): string {
        return this.formatIsoDate(date);
    }

    /**
     * Generates timestamp for unique IDs
     * @returns Current timestamp
     */
    static getTimestamp(): number {
        return Date.now();
    }

    /**
     * Formats relative time (e.g., "2 hours ago")
     * @param date Date to format
     * @returns Relative time string
     */
    static formatRelative(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 30) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
}