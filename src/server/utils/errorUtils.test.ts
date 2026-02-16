/**
 * errorUtils Unit Tests
 *
 * Tests for safe error handling utilities that extract information
 * from unknown caught values (TypeScript best practice).
 */

import { describe, it, expect } from 'vitest';
import { getErrorMessage, getErrorStack, toError } from './errorUtils';

// ============================================
// getErrorMessage
// ============================================

describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
        const error = new Error('something broke');
        expect(getErrorMessage(error)).toBe('something broke');
    });

    it('should extract message from TypeError', () => {
        const error = new TypeError('cannot read property');
        expect(getErrorMessage(error)).toBe('cannot read property');
    });

    it('should extract message from RangeError', () => {
        const error = new RangeError('out of range');
        expect(getErrorMessage(error)).toBe('out of range');
    });

    it('should return the string itself when a string is thrown', () => {
        expect(getErrorMessage('plain string error')).toBe('plain string error');
    });

    it('should return empty string for empty string', () => {
        expect(getErrorMessage('')).toBe('');
    });

    it('should extract message from object with message property', () => {
        const error = { message: 'custom error object' };
        expect(getErrorMessage(error)).toBe('custom error object');
    });

    it('should handle object with numeric message property', () => {
        const error = { message: 42 };
        expect(getErrorMessage(error)).toBe('42');
    });

    it('should stringify null', () => {
        expect(getErrorMessage(null)).toBe('null');
    });

    it('should stringify undefined', () => {
        expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should stringify number', () => {
        expect(getErrorMessage(404)).toBe('404');
    });

    it('should stringify boolean', () => {
        expect(getErrorMessage(false)).toBe('false');
    });

    it('should stringify object without message property', () => {
        const error = { code: 'ERR_UNKNOWN' };
        expect(getErrorMessage(error)).toBe('[object Object]');
    });

    it('should handle Error with empty message', () => {
        const error = new Error('');
        expect(getErrorMessage(error)).toBe('');
    });
});

// ============================================
// getErrorStack
// ============================================

describe('getErrorStack', () => {
    it('should extract stack from Error instance', () => {
        const error = new Error('test');
        const stack = getErrorStack(error);
        expect(stack).toBeDefined();
        expect(stack).toContain('Error: test');
        expect(stack).toContain('errorUtils.test.ts');
    });

    it('should return undefined for string', () => {
        expect(getErrorStack('not an error')).toBeUndefined();
    });

    it('should return undefined for null', () => {
        expect(getErrorStack(null)).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
        expect(getErrorStack(undefined)).toBeUndefined();
    });

    it('should return undefined for plain object with stack-like property', () => {
        // Even if an object has a "stack" property, we don't trust it
        // unless it's a real Error instance
        const fakeError = { message: 'fake', stack: 'fake stack trace' };
        expect(getErrorStack(fakeError)).toBeUndefined();
    });

    it('should return undefined for number', () => {
        expect(getErrorStack(42)).toBeUndefined();
    });
});

// ============================================
// toError
// ============================================

describe('toError', () => {
    it('should return same Error instance if already an Error', () => {
        const error = new Error('original');
        const result = toError(error);
        expect(result).toBe(error); // Same reference
        expect(result.message).toBe('original');
    });

    it('should wrap string in Error', () => {
        const result = toError('string error');
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('string error');
    });

    it('should wrap null in Error', () => {
        const result = toError(null);
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('null');
    });

    it('should wrap undefined in Error', () => {
        const result = toError(undefined);
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('undefined');
    });

    it('should wrap number in Error', () => {
        const result = toError(500);
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('500');
    });

    it('should wrap object with message in Error using that message', () => {
        const result = toError({ message: 'from object' });
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('from object');
    });

    it('should preserve TypeError subclass', () => {
        const error = new TypeError('type issue');
        const result = toError(error);
        expect(result).toBe(error);
        expect(result).toBeInstanceOf(TypeError);
    });

    it('should create Error with stack trace when wrapping non-Error', () => {
        const result = toError('wrapped');
        expect(result.stack).toBeDefined();
        expect(result.stack).toContain('Error: wrapped');
    });
});
