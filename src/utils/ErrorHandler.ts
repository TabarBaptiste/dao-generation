import * as vscode from 'vscode';
import { Sentry } from '../instrument';

/**
 * Utilitaire centralisé de gestion des erreurs pour standardiser le traitement des erreurs dans l'extension
 * Élimine la duplication des blocs try-catch et fournit un formatage cohérent des erreurs à l'utilisateur
 */
export class ErrorHandler {
    /**
     * Affiche un message d'erreur convivial dans VS Code avec un format et un contexte cohérents.
     * Cette méthode standardise la présentation des erreurs pour les utilisateurs, en veillant à ce que
     * tous les messages d'erreur suivent le même format et fournissent un contexte suffisant pour le dépannage.
     * 
     * @static
     * @param {string} operation Description lisible de l'opération ayant échoué (ex. "enregistrement de fichier", "connexion à la base de données")
     * @param {unknown} error L'objet d'erreur, une chaîne ou toute autre valeur qui a été levée ou rencontrée
     * @memberof ErrorHandler
     */
    static showError(operation: string, error: unknown): void {
        const message = `Échec de ${operation} : ${this.formatErrorMessage(error)}`;
        vscode.window.showErrorMessage(message);
    }

    /**
     * Affiche un message d'avertissement aux utilisateurs pour des problèmes non critiques nécessitant une attention.
     * Cette méthode fournit une alternative moins sévère que le message d'erreur pour les situations
     * où l'opération peut continuer mais où l'utilisateur doit être informé d'un problème potentiel.
     *
     * @static
     * @param {string} operation Description de l'opération ayant déclenché l'avertissement
     * @param {unknown} error Le problème ou l'erreur ayant causé la condition d'avertissement
     * @memberof ErrorHandler
     */
    static showWarning(operation: string, error: unknown): void {
        const message = `Avertissement pendant ${operation} : ${this.formatErrorMessage(error)}`;
        vscode.window.showWarningMessage(message);
    }

    /**
     * Enregistre les informations d'erreur détaillées dans la console pour le débogage et le dépannage.
     * Cette méthode fournit un logging structuré avec des informations de contexte pour aider les développeurs
     * à diagnostiquer les problèmes sans exposer les détails techniques aux utilisateurs finaux.
     *
     * @static
     * @param {string} context Contexte descriptif sur où/quand l'erreur s'est produite pour le débogage
     * @param {unknown} error L'objet d'erreur complet ou les informations à enregistrer pour l'analyse par les développeurs
     * @memberof ErrorHandler
     */
    static logError(context: string, error: unknown): void {
        console.error(`[${context}]`, error);
    }

    /**
     * Formate les objets d'erreur en messages de chaîne cohérents et conviviaux.
     * Cette méthode gère différents types d'erreur (objets Error, chaînes, valeurs inconnues)
     * et extrait des messages significatifs tout en fournissant des solutions de repli pour les formats inattendus.
     *
     * @static
     * @param {unknown} error L'erreur à formater (peut être un objet Error, une chaîne ou tout autre type)
     * @return {string} Message d'erreur propre et lisible par l'utilisateur, adapté à l'affichage dans l'interface utilisateur
     * @memberof ErrorHandler
     */
    static formatErrorMessage(error: unknown): string {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Erreur inconnue';
    }

    /**
     * Encapsule les opérations asynchrones avec une gestion et un logging d'erreur standardisés.
     * Cette méthode élimine les blocs try-catch répétitifs dans tout le code
     * en fournissant un point unique pour la gestion d'erreur asynchrone avec notification utilisateur optionnelle.
     *
     * @static
     * @template T Le type de retour de la fonction async encapsulée
     * @param {string} operation Description lisible de l'opération pour les messages d'erreur et le logging
     * @param {() => Promise<T>} asyncFn La fonction asynchrone à exécuter avec protection d'erreur
     * @param {boolean} [showUserError=true] Indique s'il faut afficher les messages d'erreur à l'utilisateur (par défaut true)
     * @param {boolean} [captureToSentry=false] Si true, envoie l'erreur à Sentry via `captureException`.
     * @param {(Record<string, unknown> | undefined)} [extra=undefined] Objet optionnel de métadonnées supplémentaires
     * @return {Promise<T | undefined>} Promise se résolvant au résultat de la fonction en cas de succès, ou undefined en cas d'erreur
     * @memberof ErrorHandler
     */
    static async handleAsync<T>(
        operation: string,
        asyncFn: () => Promise<T>,
        showUserError: boolean = true,
        captureToSentry: boolean = true,
        extra: Record<string, unknown> | undefined = undefined
    ): Promise<T | undefined> {
        try {
            return await asyncFn();
        } catch (error) {
            this.logError(operation, error);
            // Optionnel : envoyer l'erreur à Sentry si demandé
            if (captureToSentry && Sentry && typeof Sentry.captureException === 'function') {
                try {
                    Sentry.captureException(error, {
                        level: 'error',
                        tags: { 
                            operation,
                            'dao-generator-error': true  // Tag spécifique pour filtrer nos erreurs
                        },
                        extra: extra || {}
                    });
                } catch (sentryError) {
                    // Ne pas faire échouer la remontée d'erreur si Sentry plante
                    console.error('[ErrorHandler][Sentry] failed to capture exception', sentryError);
                }
            }
            if (showUserError) {
                this.showError(operation, error);
            }
            return undefined;
        }
    }

    /**
     * Encapsule les opérations synchrones avec une gestion d'erreur standardisée et un retour utilisateur optionnel.
     * Cette méthode fournit les mêmes avantages de gestion d'erreur que handleAsync mais pour
     * les opérations synchrones qui peuvent lever des exceptions.
     *
     * @static
     * @template T Le type de retour de la fonction sync encapsulée
     * @param {string} operation Description lisible de l'opération pour les messages d'erreur et le logging
     * @param {() => T} syncFn La fonction synchrone à exécuter avec protection d'erreur
     * @param {boolean} [showUserError=true] Indique s'il faut afficher les messages d'erreur à l'utilisateur (par défaut true)
     * @param {boolean} [captureToSentry=false] Si true, envoie l'erreur à Sentry via `captureException`.
     * @param {(Record<string, unknown> | undefined)} [extra=undefined] Objet optionnel de métadonnées supplémentaires
     * @return {(T | undefined)} Résultat de la fonction en cas de succès, ou undefined en cas d'erreur
     * @memberof ErrorHandler
     */
    static handleSync<T>(
        operation: string,
        syncFn: () => T,
        showUserError: boolean = true,
        captureToSentry: boolean = true,
        extra: Record<string, unknown> | undefined = undefined
    ): T | undefined {
        try {
            return syncFn();
        } catch (error) {
            this.logError(operation, error);
            if (captureToSentry && Sentry && typeof Sentry.captureException === 'function') {
                try {
                    Sentry.captureException(error, {
                        level: 'error',
                        tags: { 
                            operation,
                            'dao-generator-error': true  // Tag spécifique pour filtrer nos erreurs
                        },
                        extra: extra || {}
                    });
                } catch (sentryError) {
                    console.error('[ErrorHandler][Sentry] failed to capture exception', sentryError);
                }
            }
            if (showUserError) {
                this.showError(operation, error);
            }
            return undefined;
        }
    }
}