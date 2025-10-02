import * as assert from 'assert';
import * as vscode from 'vscode';
import { SecureEncryptionUtil } from '../../utils/SecureEncryptionUtil';

suite('Tests de sécurité du chiffrement', () => {
    let mockContext: vscode.ExtensionContext;
    
    setup(() => {
        // Mock du contexte VS Code pour les tests
        mockContext = {
            secrets: {
                store: async (key: string, value: string) => {},
                get: async (key: string) => 'test-master-key-base64',
                delete: async (key: string) => {}
            }
        } as any;
    });

    test('Chiffrement/déchiffrement avec succès', async () => {
        const testData = 'password123';
        
        const encrypted = await SecureEncryptionUtil.encrypt(testData, mockContext);
        assert.ok(encrypted, 'Le chiffrement doit réussir');
        assert.ok(encrypted!.encrypted, 'Données chiffrées requises');
        assert.ok(encrypted!.iv, 'IV requis');
        assert.ok(encrypted!.tag, 'Tag d\'authentification requis');
        assert.ok(encrypted!.salt, 'Salt requis');
        
        const decrypted = await SecureEncryptionUtil.decrypt(
            encrypted!.encrypted,
            encrypted!.iv,
            encrypted!.tag,
            encrypted!.salt,
            mockContext
        );
        
        assert.strictEqual(decrypted, testData, 'Déchiffrement doit restaurer les données originales');
    });

    test('Échec de déchiffrement avec tag modifié (test d\'intégrité)', async () => {
        const testData = 'password123';
        
        const encrypted = await SecureEncryptionUtil.encrypt(testData, mockContext);
        assert.ok(encrypted, 'Le chiffrement doit réussir');
        
        // Modifier le tag pour simuler une corruption/attaque
        const corruptedTag = encrypted!.tag.slice(0, -2) + '00';
        
        const decrypted = await SecureEncryptionUtil.decrypt(
            encrypted!.encrypted,
            encrypted!.iv,
            corruptedTag,
            encrypted!.salt,
            mockContext
        );
        
        assert.strictEqual(decrypted, null, 'Déchiffrement doit échouer avec tag corrompu');
    });

    test('IV unique à chaque chiffrement', async () => {
        const testData = 'password123';
        
        const encrypted1 = await SecureEncryptionUtil.encrypt(testData, mockContext);
        const encrypted2 = await SecureEncryptionUtil.encrypt(testData, mockContext);
        
        assert.ok(encrypted1 && encrypted2, 'Les deux chiffrements doivent réussir');
        assert.notStrictEqual(encrypted1.iv, encrypted2.iv, 'Les IV doivent être différents');
        assert.notStrictEqual(encrypted1.encrypted, encrypted2.encrypted, 'Les données chiffrées doivent être différentes');
        assert.notStrictEqual(encrypted1.salt, encrypted2.salt, 'Les salts doivent être différents');
    });

    test('Migration depuis l\'ancien système', async () => {
        // Simuler des données de l'ancien système
        const oldEncryptedData = '5a7b8c9d...'; // hex simulé
        const oldIv = '1a2b3c4d...'; // hex simulé
        
        // Note: Ce test nécessiterait des vraies données de l'ancien système
        // pour être complètement fonctionnel
        const migrated = await SecureEncryptionUtil.migrateFromOldEncryption(
            oldEncryptedData,
            oldIv,
            mockContext
        );
        
        // Vérifier que la migration gère les erreurs gracieusement
        assert.ok(migrated === null, 'Migration doit retourner null pour données invalides');
    });
});