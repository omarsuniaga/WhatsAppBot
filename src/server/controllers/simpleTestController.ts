/**
 * Simplified Test for Daily Reminder
 * This bypasses complex dependencies and tests core functionality
 */

import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Simple test endpoint that doesn't depend on complex services
 */
export const testSimpleReminder = async (req: Request, res: Response): Promise<void> => {
    try {
        const today = new Date();
        const dayName = today.toLocaleDateString('es-DO', { weekday: 'long' });
        const formattedDate = today.toLocaleDateString('es-DO', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });

        const testMessage = `ðŸŽ» *RECORDATORIO GENERAL - El Sistema Punta Cana*

ðŸ“… ${dayName} ${formattedDate}

ðŸŽµ *Clases del DÃ­a:*
â€¢ ViolÃ­n BÃ¡sico - 3:00 PM - SalÃ³n A
â€¢ Piano Intermedio - 4:00 PM - SalÃ³n B
â€¢ Guitarra Avanzada - 5:00 PM - SalÃ³n C

ðŸ“š *Recordatorios Importantes:*
â€¢ Llegar 10 minutos antes de cada clase
â€¢ Traer sus instrumentos y materiales
â€¢ Practicar en casa diariamente

ðŸ’ª *MotivaciÃ³n:*
"La mÃºsica es el lenguaje universal del espÃ­ritu. Â¡Sigue adelante!"

ðŸŽ¶ *El Sistema Punta Cana - Transformando vidas a travÃ©s de la mÃºsica*

---
*Este es un mensaje de prueba generado exitosamente.*`;

        res.json({
            success: true,
            message: 'Test message generated successfully',
            data: {
                draftMessage: testMessage,
                timestamp: new Date().toISOString(),
                test: true,
                source: 'simple-test-endpoint'
            }
        });
    } catch (error: unknown) {
        Logger.error('[SimpleTest] Error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Test configuration without dependencies
 */
export const testConfigSimple = async (req: Request, res: Response): Promise<void> => {
    try {
        const testConfig = {
            enabled: true,
            scheduleTime: '12:01',
            targetGroups: [
                'PROGRAMA ORQUESTAL - El Sistema Punta Cana',
                'PROGRAMA CORAL'
            ],
            autoSend: false,
            test: true,
            lastRunAt: new Date().toISOString()
        };

        res.json({
            success: true,
            data: testConfig
        });
    } catch (error: unknown) {
        Logger.error('[SimpleTest] Config error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};
