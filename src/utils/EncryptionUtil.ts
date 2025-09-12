import * as crypto from 'crypto';
import { ENCRYPTION } from '../constants/AppConstants';

/**
 * Utility class for encryption and decryption operations
 * Centralizes crypto operations to eliminate duplication
 */
export class EncryptionUtil {
    private static readonly ALGORITHM = ENCRYPTION.ALGORITHM;
    private static readonly SALT = ENCRYPTION.SALT;

    /**
     * Encrypts a string using AES-256-CBC
     * @param data Data to encrypt
     * @param masterKey Master key for encryption
     * @returns Object containing encrypted data and IV
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
     * Decrypts encrypted data using AES-256-CBC
     * @param encryptedData Encrypted data in hex format
     * @param iv Initialization vector in hex format
     * @param masterKey Master key for decryption
     * @returns Decrypted string
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
     * Safely encrypts data with error handling
     * @param data Data to encrypt
     * @param masterKey Master key for encryption
     * @returns Encryption result or null on error
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
     * Safely decrypts data with error handling
     * @param encryptedData Encrypted data in hex format
     * @param iv Initialization vector in hex format
     * @param masterKey Master key for decryption
     * @returns Decrypted string or null on error
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