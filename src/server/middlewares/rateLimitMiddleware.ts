import { Request, Response, NextFunction } from 'express';
import RateLimitService from '../services/rateLimitService';
import { RateLimitStatus } from '../types';

// Extend Express Request to include rate limit status
declare global {
    namespace Express {
        interface Request {
            rateLimitStatus?: RateLimitStatus;
        }
    }
}

/**
 * Middleware that checks rate limit and adds informational headers
 * Does NOT block requests, just adds status info
 */
export const checkRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const rateLimitService = RateLimitService.getInstance();
    const status = rateLimitService.canSendIndividual();

    // Attach status to request for use in controllers
    req.rateLimitStatus = status;

    // Add informational headers
    res.setHeader('X-RateLimit-Limit', '30');
    res.setHeader('X-RateLimit-Remaining', status.messagesRemaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(status.resetIn / 1000).toString());

    if (status.isBlocked && status.blockedUntil) {
        res.setHeader('X-RateLimit-Blocked-Until', status.blockedUntil.toString());
    }

    if (status.warningLevel !== 'none') {
        res.setHeader('X-RateLimit-Warning', status.warningLevel);
    }

    next();
};

/**
 * Middleware that enforces rate limit - blocks requests if limit exceeded
 * Use AFTER checkRateLimit middleware
 */
export const enforceRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const status = req.rateLimitStatus;

    // If status wasn't set by checkRateLimit, get it now
    if (!status) {
        const rateLimitService = RateLimitService.getInstance();
        req.rateLimitStatus = rateLimitService.canSendIndividual();
    }

    if (!req.rateLimitStatus?.canSend) {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: req.rateLimitStatus?.warningMessage || 'Too many requests',
            rateLimitStatus: req.rateLimitStatus
        });
        return;
    }

    next();
};

/**
 * Combined middleware for convenience
 * Checks AND enforces rate limit in one step
 */
export const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
    checkRateLimit(req, res, () => {
        enforceRateLimit(req, res, next);
    });
};

/**
 * Middleware to skip rate limiting for group/broadcast messages
 * Check the target to determine if rate limiting should apply
 */
export const conditionalRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const { number, target } = req.body;
    const destination = number || target || '';

    // Skip rate limiting for WhatsApp groups (@g.us) and broadcasts
    if (destination.includes('@g.us') || destination.includes('@broadcast')) {
        next();
        return;
    }

    // Apply rate limiting for individual messages
    rateLimit(req, res, next);
};
