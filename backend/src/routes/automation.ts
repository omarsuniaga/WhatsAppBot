/**
 * Automation Routes
 * API routes for attendance alert automation
 */

import { Router } from 'express';
import * as automationController from '../controllers/automationController';

const router = Router();

// Alert configuration
router.get('/automation/alerts/config', automationController.getAlertConfig);
router.put('/automation/alerts/config', automationController.updateAlertConfig);

// Alert history and stats
router.get('/automation/alerts/history', automationController.getAlertHistory);
router.get('/automation/alerts/stats', automationController.getAlertStats);

// Manual trigger
router.post('/automation/alerts/generate', automationController.generateDrafts);

export { router as automationRouter };
