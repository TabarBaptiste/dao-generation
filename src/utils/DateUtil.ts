/**
 * Fonctions utilitaires de date et heure pour un formatage standardisé dans l'application.
 * Centralise toutes les opérations de manipulation de dates pour garantir la cohérence
 * et éliminer les duplications.
 */
export class DateUtil {
    /**
     * Formatte une date selon les conventions françaises en remplaçant les caractères
     * problématiques pour garantir la compatibilité avec les systèmes de fichiers.
     * Cette méthode génère une chaîne date/heure adaptée aux journaux et sauvegardes.
     * 
     * @static
     * @param {Date} [date=new Date()] Objet Date à formater, utilise la date/heure courante par défaut
     * @return {string} Chaîne formatée "DD-MM-YYYY-HH-mm-ss", sûre pour les noms de fichiers
     * @memberof DateUtil
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
     * Formatte une date pour l'utiliser dans un nom de fichier de manière sûre.
     * Utilise des underscores et des tirets pour éviter les caractères spéciaux problématiques.
     *
     * @param {Date} [date=new Date()] Objet Date à formater, utilise la date/heure courante par défaut
     * @return {string} Chaîne sûre pour les noms de fichiers au format "YYYY-MM-DD_HH-mm-ss"
     * @memberof DateUtil
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
     * Formatte une date au format ISO 8601 (partie date seulement) pour une représentation standardisée.
     * Cette méthode extrait uniquement la portion date (année-mois-jour) sans composantes temporelles,
     * utile pour le stockage en base, la communication via API et les comparaisons de dates.
     *
     * @static
     * @param {Date} [date=new Date()] Objet Date à formater, utilise la date courante par défaut
     * @return {string} Chaîne de date au format ISO "YYYY-MM-DD" pour compatibilité universelle
     * @memberof DateUtil
     */
    static formatIsoDate(date: Date = new Date()): string {
        return date.toISOString().slice(0, 10);
    }

    /**
     * Formatte une date spécialement pour les en-têtes de documentation PHP et la génération de code.
     * Cette méthode fournit un format de date cohérent pour les fichiers PHP générés,
     * garantissant des standards de documentation homogènes dans les classes DAO générées.
     *
     * @static
     * @param {Date} [date=new Date()] Objet Date à formater, utilise la date courante par défaut
     * @return {string} Chaîne de date au format ISO (YYYY-MM-DD) adaptée aux annotations PHP @date
     * @memberof DateUtil
     */
    static formatForPhpDoc(date: Date = new Date()): string {
        return this.formatIsoDate(date);
    }

    /**
     * Génère un timestamp précis pour la création d'identifiants uniques et le suivi des dates de création.
     * Cette méthode retourne le nombre de millisecondes écoulées depuis l'époque Unix,
     * fournissant une précision suffisante pour la génération d'ID et l'ordonnancement temporel.
     *
     * @static
     * @return {number} Timestamp courant en millisecondes depuis le 1er janvier 1970 UTC
     * @memberof DateUtil
     */
    static getTimestamp(): number {
        return Date.now();
    }

    /**
     * Formatte une date en temps relatif lisible par l'humain pour un affichage plus intuitif.
     * Cette méthode calcule la différence temporelle et la présente en langage naturel,
     * améliorant l'expérience utilisateur en affichant par exemple "il y a 2 heures".
     *
     * @static
     * @param {Date} date - Date passée à partir de laquelle calculer le temps relatif (doit être antérieure à la date courante)
     * @return {string} Chaîne de temps relatif en français (ex. "À l'instant", "il y a 5 minutes", "il y a 2 jours")
     * @memberof DateUtil
     */
    static formatRelative(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'À l\'instant';
        } else if (diffMins < 60) {
            return diffMins === 1 ? 'il y a 1 minute' : `il y a ${diffMins} minutes`;
        } else if (diffHours < 24) {
            return diffHours === 1 ? 'il y a 1 heure' : `il y a ${diffHours} heures`;
        } else if (diffDays < 30) {
            return diffDays === 1 ? 'il y a 1 jour' : `il y a ${diffDays} jours`;
        } else {
            return date.toLocaleDateString('fr-FR');
        }
    }
}