import * as vscode from 'vscode';

/**
 * Centralized error handling utility to standardize error management
 * Eliminates duplication of try-catch patterns and error formatting
 */
export class ErrorHandler {
    /**
     * Shows error message to user with consistent formatting
     * @param operation Description of the operation that failed
     * @param error The error that occurred
     */
    static showError(operation: string, error: unknown): void {
        const message = `Failed to ${operation}: ${this.formatErrorMessage(error)}`;
        vscode.window.showErrorMessage(message);
    }

    /**
     * Shows warning message to user
     * @param operation Description of the operation
     * @param error The error that occurred
     */
    static showWarning(operation: string, error: unknown): void {
        const message = `Warning during ${operation}: ${this.formatErrorMessage(error)}`;
        vscode.window.showWarningMessage(message);
    }

    /**
     * Logs error to console with context
     * @param context Context description for debugging
     * @param error The error that occurred
     */
    static logError(context: string, error: unknown): void {
        console.error(`[${context}]`, error);
    }

    /**
     * Formats error message with consistent pattern
     * @param error The error to format
     * @returns Formatted error message
     */
    static formatErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Unknown error';
    }

    /**
     * Handles async operations with standardized error handling
     * @param operation Description of operation
     * @param asyncFn The async function to execute
     * @param showUserError Whether to show error to user (default: true)
     * @returns Promise that resolves to result or undefined on error
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
     * Wraps sync operations with error handling
     * @param operation Description of operation
     * @param syncFn The function to execute
     * @param showUserError Whether to show error to user (default: true)
     * @returns Result or undefined on error
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