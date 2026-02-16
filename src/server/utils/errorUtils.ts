/**
 * Safe error handling utilities.
 *
 * TypeScript best practice: catch blocks should use `unknown` instead of `any`.
 * These helpers extract error information safely from unknown thrown values.
 */

/**
 * Extract error message from an unknown caught value.
 * Works with Error instances, strings, and arbitrary objects.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

/**
 * Extract error stack from an unknown caught value.
 */
export function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
}

/**
 * Ensure an unknown value is an Error instance.
 * If it's not, wraps it in a new Error.
 */
export function toError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(getErrorMessage(error));
}
