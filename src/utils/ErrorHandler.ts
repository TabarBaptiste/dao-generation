import * as vscode from 'vscode';

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
     * Logs detailed error information to the console for debugging and troubleshooting.
     * This method provides structured logging with context information to help developers
     * diagnose issues without exposing technical details to end users.
     *
     * @static
     * @param {string} context Descriptive context about where/when the error occurred for debugging purposes
     * @param {unknown} error The complete error object or information to log for developer analysis
     * @memberof ErrorHandler
     */
    static logError(context: string, error: unknown): void {
        console.error(`[${context}]`, error);
    }

    /**
     * Formats error objects into consistent, user-friendly string messages.
     * This method handles various error types (Error objects, strings, unknown values)
     * and extracts meaningful messages while providing fallbacks for unexpected formats.
     *
     * @static
     * @param {unknown} error The error to format (can be Error object, string, or any other type)
     * @return {string} Clean, user-readable error message suitable for display in UI
     * @memberof ErrorHandler
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
     * Wraps asynchronous operations with standardized error handling and logging.
     * This method eliminates repetitive try-catch blocks throughout the codebase
     * by providing a single point for async error management with optional user notification.
     *
     * @static
     * @template T The return type of the async function being wrapped
     * @param {string} operation Human-readable description of the operation for error messages and logging
     * @param {() => Promise<T>} asyncFn The asynchronous function to execute with error protection
     * @param {boolean} [showUserError=true] Whether to display error messages to the user (defaults to true)
     * @return {Promise<T | undefined>} Promise resolving to the function result on success, or undefined on error
     * @memberof ErrorHandler
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
     * Wraps synchronous operations with standardized error handling and optional user feedback.
     * This method provides the same error management benefits as handleAsync but for
     * synchronous operations that may throw exceptions.
     *
     * @static
     * @template T The return type of the sync function being wrapped
     * @param {string} operation Human-readable description of the operation for error messages and logging
     * @param {() => T} syncFn The synchronous function to execute with error protection
     * @param {boolean} [showUserError=true] Whether to display error messages to the user (defaults to true)
     * @return {(T | undefined)} Function result on success, or undefined on error
     * @memberof ErrorHandler
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