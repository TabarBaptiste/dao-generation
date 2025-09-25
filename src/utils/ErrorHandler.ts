import * as vscode from 'vscode';

/**
 * Utilitaire centralisé de gestion des erreurs pour standardiser la gestion d'erreur
 * Élimine la duplication des patterns try-catch et du formatage d'erreurs
 */
export class ErrorHandler {
    /**
     * Affiche un message d'erreur à l'utilisateur avec un formatage cohérent
     * @param operation Description de l'opération qui a échoué
     * @param error L'erreur qui s'est produite
     */
    static showError(operation: string, error: unknown): void {
        const message = `Échec de ${operation} : ${this.formatErrorMessage(error)}`;
        vscode.window.showErrorMessage(message);
    }

    /**
     * Affiche un message d'avertissement à l'utilisateur
     * @param operation Description de l'opération
     * @param error L'erreur qui s'est produite
     */
    static showWarning(operation: string, error: unknown): void {
        const message = `Avertissement pendant ${operation} : ${this.formatErrorMessage(error)}`;
        vscode.window.showWarningMessage(message);
    }

    /**
     * Enregistre l'erreur dans la console avec le contexte
     * @param context Description du contexte pour le débogage
     * @param error L'erreur qui s'est produite
     */
    static logError(context: string, error: unknown): void {
        console.error(`[${context}]`, error);
    }

    /**
     * Formate le message d'erreur avec un pattern cohérent
     * @param error L'erreur à formater
     * @returns Message d'erreur formaté
     */
    static formatErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Erreur inconnue';
    }

    /**
     * Gère les opérations asynchrones avec gestion d'erreur standardisée
     * @param operation Description de l'opération
     * @param asyncFn La fonction asynchrone à exécuter
     * @param showUserError Si afficher l'erreur à l'utilisateur (par défaut : true)
     * @returns Promise qui se résout avec le résultat ou undefined en cas d'erreur
     */
    static async handleAsync<T>(
        operation: string,
        asyncFn: () => Promise<T>,
        showUserError: boolean = true
    ): Promise<T | undefined> {
        try {
            return await asyncFn();
        } catch (error) {
            this.logError(operation, error);
            if (showUserError) {
                this.showError(operation, error);
            }
            return undefined;
        }
    }

    /**
     * Encapsule les opérations synchrones avec gestion d'erreur
     * @param operation Description de l'opération
     * @param syncFn La fonction à exécuter
     * @param showUserError Si afficher l'erreur à l'utilisateur (par défaut : true)
     * @returns Résultat ou undefined en cas d'erreur
     */
    static handleSync<T>(
        operation: string,
        syncFn: () => T,
        showUserError: boolean = true
    ): T | undefined {
        try {
            return syncFn();
        } catch (error) {
            this.logError(operation, error);
            if (showUserError) {
                this.showError(operation, error);
            }
            return undefined;
        }
    }
}