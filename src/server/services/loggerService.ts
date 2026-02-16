import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export class Logger extends EventEmitter {
    private static instance: Logger;
    private logFile: string;

    private constructor() {
        super();
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logFile = path.join(logDir, 'app.log');
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(level: LogLevel, message: string, context?: any): string {
        const timestamp = new Date().toISOString();
        let contextStr = '';
        if (context) {
            try {
                if (context instanceof Error) {
                    contextStr = context.stack || context.message;
                } else if (typeof context === 'object') {
                    contextStr = JSON.stringify(context, (key, value) => {
                        if (value instanceof Error) {
                            return {
                                name: value.name,
                                message: value.message,
                                stack: value.stack,
                                cause: (value as any).cause
                            };
                        }
                        return value;
                    });
                } else {
                    contextStr = String(context);
                }
            } catch (e) {
                contextStr = '[Circular/Error]';
            }
        }
        return `[${timestamp}] [${level}] ${message} ${contextStr ? `| ${contextStr}` : ''}`;
    }

    private writeToFile(message: string) {
        fs.appendFile(this.logFile, message + '\n', (err) => {
            if (err) console.error('Failed to write to log file:', err);
        });
    }

    log(level: LogLevel, message: string, context?: any) {
        const formatted = this.formatMessage(level, message, context);
        // Also log to console for development
        const consoleMethod = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : console.log;
        consoleMethod(formatted);
        this.writeToFile(formatted);
        this.emit('log', { level, message: formatted, timestamp: new Date().toISOString() });
    }

    info(message: string, context?: any) {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: any) {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, context?: any) {
        this.log(LogLevel.ERROR, message, context);
    }

    debug(message: string, context?: any) {
        if (process.env.DEBUG === 'true') {
            this.log(LogLevel.DEBUG, message, context);
        }
    }
}

export default Logger.getInstance();
