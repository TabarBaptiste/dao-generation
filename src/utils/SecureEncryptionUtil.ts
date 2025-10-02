import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ErrorHandler } from './ErrorHandler';

/**
 * Utilitaire de chiffrement sécurisé utilisant VS Code Secret Storage pour la gestion des clés.
 * Implémente AES-256-GCM avec authentification intégrée et dérivation de clé robuste.
 */
export class SecureEncryptionUtil {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly KEY_LENGTH = 32;
    private static readonly IV_LENGTH = 12; // GCM recommande 12 bytes
    private static readonly TAG_LENGTH = 16;
    private static readonly SCRYPT_PARAMS = {
        N: 32768,  // 2^15 - résistant aux attaques GPU 2025
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024 // 64MB max
    };

    /**
     * Initialise ou récupère la clé maître depuis VS Code Secret Storage.
     * Génère une nouvelle clé aléatoire si aucune n'existe.
     *
     * @private
     * @static
     * @param {vscode.ExtensionContext} context
     * @return {*}  {Promise<string>}
     * @memberof SecureEncryptionUtil
     */
    private static async getMasterKey(context: vscode.ExtensionContext): Promise<string> {
        const MASTER_KEY_ID = 'phpDaoGenerator.masterKey';
        
        // Tenter de récupérer la clé existante
        let masterKey = await context.secrets.get(MASTER_KEY_ID);
        
        if (!masterKey) {
            // Générer une nouvelle clé cryptographiquement sécurisée
            masterKey = crypto.randomBytes(32).toString('base64');
            await context.secrets.store(MASTER_KEY_ID, masterKey);
            
            vscode.window.showInformationMessage(
                'Nouvelle clé de chiffrement générée et stockée de manière sécurisée.'
            );
        }
        
        return masterKey;
    }

    /**
     * Chiffre des données avec AES-256-GCM et authentification intégrée.
     * Utilise scrypt avec paramètres renforcés contre les attaques GPU.
     *
     * @static
     * @param {string} data
     * @param {vscode.ExtensionContext} context
     * @param {string} [additionalData]
     * @return {*}  {(Promise<{ encrypted: string; iv: string; tag: string; salt: string } | null>)}
     * @memberof SecureEncryptionUtil
     */
    static async encrypt(
        data: string, 
        context: vscode.ExtensionContext,
        additionalData?: string
    ): Promise<{ encrypted: string; iv: string; tag: string; salt: string } | null> {
        const result = await ErrorHandler.handleAsync(
            'chiffrement sécurisé des données',
            async () => {
                const masterKey = await this.getMasterKey(context);
                const salt = crypto.randomBytes(16);
                const iv = crypto.randomBytes(this.IV_LENGTH);
                
                // Dérivation de clé avec paramètres renforcés
                const key = crypto.scryptSync(
                    masterKey, 
                    salt, 
                    this.KEY_LENGTH,
                    this.SCRYPT_PARAMS
                );
                
                const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
                
                // Données additionnelles authentifiées (optionnel)
                if (additionalData) {
                    cipher.setAAD(Buffer.from(additionalData, 'utf8'));
                }
                
                let encrypted = cipher.update(data, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                
                const tag = cipher.getAuthTag();
                
                return {
                    encrypted,
                    iv: iv.toString('hex'),
                    tag: tag.toString('hex'),
                    salt: salt.toString('hex')
                };
            }
        );
        
        return result || null;
    }

    /**
     * Déchiffre des données avec vérification d'authenticité intégrée.
     * Échec automatique si les données ont été modifiées.
     *
     * @static
     * @param {string} encryptedData
     * @param {string} iv
     * @param {string} tag
     * @param {string} salt
     * @param {vscode.ExtensionContext} context
     * @param {string} [additionalData]
     * @return {*}  {(Promise<string | null>)}
     * @memberof SecureEncryptionUtil
     */
    static async decrypt(
        encryptedData: string,
        iv: string,
        tag: string,
        salt: string,
        context: vscode.ExtensionContext,
        additionalData?: string
    ): Promise<string | null> {
        const result = await ErrorHandler.handleAsync(
            'déchiffrement sécurisé des données',
            async () => {
                const masterKey = await this.getMasterKey(context);
                const saltBuffer = Buffer.from(salt, 'hex');
                const ivBuffer = Buffer.from(iv, 'hex');
                const tagBuffer = Buffer.from(tag, 'hex');
                
                // Reconstruction de la clé avec les mêmes paramètres
                const key = crypto.scryptSync(
                    masterKey,
                    saltBuffer,
                    this.KEY_LENGTH,
                    this.SCRYPT_PARAMS
                );
                
                const decipher = crypto.createDecipheriv(this.ALGORITHM, key, ivBuffer);
                decipher.setAuthTag(tagBuffer);
                
                // Vérification des données additionnelles
                if (additionalData) {
                    decipher.setAAD(Buffer.from(additionalData, 'utf8'));
                }
                
                let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
                decrypted += decipher.final('utf8'); // Lève une exception si tag invalide
                
                return decrypted;
            }
        );
        
        return result || null;
    }

    /**
     * Migre les données de l'ancien système vers le nouveau.
     * À utiliser une seule fois lors de la mise à jour.
     *
     * @static
     * @param {string} oldEncryptedData
     * @param {string} oldIv
     * @param {vscode.ExtensionContext} context
     * @return {*}  {(Promise<{ encrypted: string; iv: string; tag: string; salt: string } | null>)}
     * @memberof SecureEncryptionUtil
     */
    static async migrateFromOldEncryption(
        oldEncryptedData: string,
        oldIv: string,
        context: vscode.ExtensionContext
    ): Promise<{ encrypted: string; iv: string; tag: string; salt: string } | null> {
        // Déchiffrement avec l'ancien système
        const oldKey = crypto.scryptSync('phpDaoGenerator_storage_key_v1', 'salt', 32);
        const oldIvBuffer = Buffer.from(oldIv, 'hex');
        
        try {
            const decipher = crypto.createDecipheriv('aes-256-cbc', oldKey, oldIvBuffer);
            let decrypted = decipher.update(oldEncryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            // Rechiffrement avec le nouveau système
            return await this.encrypt(decrypted, context);
        } catch (error) {
            console.error('Échec de migration des données chiffrées:', error);
            return null;
        }
    }

    /**
     * Supprime la clé maître du stockage sécurisé.
     * ⚠️ Attention : rendra tous les données chiffrées irrécupérables !
     *
     * @static
     * @param {vscode.ExtensionContext} context
     * @return {*}  {Promise<void>}
     * @memberof SecureEncryptionUtil
     */
    static async resetMasterKey(context: vscode.ExtensionContext): Promise<void> {
        const MASTER_KEY_ID = 'phpDaoGenerator.masterKey';
        await context.secrets.delete(MASTER_KEY_ID);
        
        vscode.window.showWarningMessage(
            'Clé de chiffrement supprimée. Toutes les connexions sauvegardées devront être reconfigurées.'
        );
    }
}