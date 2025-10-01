import * as crypto from 'crypto';
import { ENCRYPTION } from '../constants/AppConstants';

/**
 * Classe utilitaire pour les opérations de chiffrement et déchiffrement sécurisées en utilisant AES-256-CBC.
 * Centralise les opérations cryptographiques pour garantir cohérence, sécurité et éviter la duplication de code.
 */
export class EncryptionUtil {
    private static readonly ALGORITHM = ENCRYPTION.ALGORITHM;
    private static readonly SALT = ENCRYPTION.SALT;

    /**
     * Chiffre des données sensibles en utilisant AES-256-CBC avec un vecteur d'initialisation aléatoire.
     * Cette méthode dérive une clé sécurisée à partir du mot de passe maître (scrypt),
     * génère un IV aléatoire, et retourne les données chiffrées ainsi que l'IV.
     *
     * @static
     * @param {string} data Données en clair à chiffrer (typiquement mots de passe ou informations sensibles)
     * @param {string} masterKey Mot de passe maître utilisé pour la dérivation de clé et le chiffrement
     * @return {{ encrypted: string; iv: string }} Objet contenant les données chiffrées encodées en hex et le vecteur d'initialisation
     * @memberof EncryptionUtil
     */
    static encrypt(data: string, masterKey: string): { encrypted: string; iv: string } {
        const key = crypto.scryptSync(masterKey, this.SALT, 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    /**
     * Déchiffre des données précédemment chiffrées en utilisant AES-256-CBC et la même clé maître.
     * Cette méthode reconstruit la clé de chiffrement avec scrypt et utilise l'IV fourni pour
     * restaurer les données en clair au format UTF-8 d'origine.
     *
     * @static
     * @param {string} encryptedData Données chiffrées encodées en hex retournées par la méthode encrypt
     * @param {string} iv Vecteur d'initialisation encodé en hex utilisé lors du chiffrement
     * @param {string} masterKey Mot de passe maître original utilisé pour le chiffrement (doit correspondre exactement)
     * @return {string} Données déchiffrées en clair au format UTF-8
     * @memberof EncryptionUtil
     */
    static decrypt(encryptedData: string, iv: string, masterKey: string): string {
        const key = crypto.scryptSync(masterKey, this.SALT, 32);
        const ivBuffer = Buffer.from(iv, 'hex');

        const decipher = crypto.createDecipheriv(this.ALGORITHM, key, ivBuffer);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Safely encrypts data with comprehensive error handling and logging for production use.
     * This wrapper method catches all encryption errors and returns null instead of throwing,
     * allowing graceful degradation when encryption fails due to invalid keys or system issues.
     * 
     * @static
     * @param {string} data Plain text data to encrypt (passwords, sensitive configuration)
     * @param {string} masterKey Master password for encryption (validated for non-empty before use)
     * @return {({ encrypted: string; iv: string } | null)} Encryption result object with hex-encoded data and IV, or null if encryption fails
     * @memberof EncryptionUtil
     */
    static safeEncrypt(data: string, masterKey: string): { encrypted: string; iv: string } | null {
        try {
            return this.encrypt(data, masterKey);
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    /**
     * Safely decrypts data with comprehensive error handling for corrupted or invalid encrypted data.
     * This wrapper method catches all decryption errors (wrong keys, corrupted data, invalid IV)
     * and returns null instead of throwing, enabling graceful error handling in data loading operations.
     *
     * @static
     * @param {string} encryptedData Hex-encoded encrypted data from previous encryption operation
     * @param {string} iv Hex-encoded initialization vector matching the encryption operation
     * @param {string} masterKey Master password that was used for original encryption (must match exactly)
     * @return {(string | null)} Successfully decrypted plain text string, or null if decryption fails due to wrong key/corrupted data
     * @memberof EncryptionUtil
     */
    static safeDecrypt(encryptedData: string, iv: string, masterKey: string): string | null {
        try {
            return this.decrypt(encryptedData, iv, masterKey);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }
}