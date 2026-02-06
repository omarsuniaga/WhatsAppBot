/**
 * Admin Authentication Middleware
 * Simple API key validation for admin endpoints
 * 
 * Set ADMIN_API_KEY in environment variables
 */

import { Request, Response, NextFunction } from 'express';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

export interface AuthenticatedRequest extends Request {
    isAdmin?: boolean;
}

/**
 * Middleware to check admin API key for write operations
 * Read operations (GET) are allowed without auth for now
 * Write operations (POST, PUT, DELETE) require valid API key
 */
export const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Allow read operations without auth (can be changed later)
    if (req.method === 'GET') {
        return next();
    }

    // Check for API key in header
    const apiKey = req.headers['x-admin-api-key'] as string;

    if (!ADMIN_API_KEY) {
        console.warn('[AdminAuth] ADMIN_API_KEY not configured - rejecting write request');
        return res.status(503).json({
            success: false,
            error: 'Admin API not configured'
        });
    }

    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing API key'
        });
    }

    req.isAdmin = true;
    next();
};

/**
 * Optional auth check - sets isAdmin flag but doesn't reject
 */
export const optionalAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-admin-api-key'] as string;
    req.isAdmin = !!(ADMIN_API_KEY && apiKey === ADMIN_API_KEY);
    next();
};

/**
 * Strict auth for all operations including GET
 */
export const requireStrictAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-admin-api-key'] as string;

    if (!ADMIN_API_KEY) {
        return res.status(503).json({
            success: false,
            error: 'Admin API not configured'
        });
    }

    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing API key'
        });
    }

    req.isAdmin = true;
    next();
};
