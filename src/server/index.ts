import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';

import routes from './routes';
import BotService from './services/botService';
import { initializePersistence } from './persistence';
import { initializeRepositories } from '../../backend/src/repos';
import Logger from './services/loggerService';
import ErrorHandler from './utils/errorHandler';

// Initialize Error Handler with graceful shutdown
const errorHandler = ErrorHandler.getInstance();

// Create shutdown tasks for our services
const shutdownTasks = ErrorHandler.createDefaultShutdownTasks();

// Register our specific shutdown tasks
shutdownTasks.push({
    name: 'stop_broadcast_schedulers',
    priority: 2,
    timeout: 5000,
    task: async () => {
        // Detener schedulers de broadcast
        try {
            const broadcastScheduler = BroadcastSchedulerService.getInstance();
            broadcastScheduler.stop();
        } catch (error) {
            Logger.warn('Error stopping broadcast scheduler:', error);
        }
    }
}, {
    name: 'stop_firestore_worker',
    priority: 2,
    timeout: 5000,
    task: async () => {
        // Detener worker de Firestore
        try {
            const firestoreBroadcast = FirestoreBroadcastService.getInstance();
            firestoreBroadcast.stop();
        } catch (error) {
            Logger.warn('Error stopping Firestore worker:', error);
        }
    }
}, {
    name: 'cleanup_bot_service',
    priority: 3,
    timeout: 8000,
    task: async () => {
        // Clean up BotService intervals and rate limiter
        try {
            const botService = BotService.getInstance();
            botService.shutdown();
        } catch (error) {
            Logger.warn('Error cleaning up BotService:', error);
        }
    }
}, {
    name: 'save_persistence_data',
    priority: 2,
    timeout: 10000,
    task: async () => {
        // Forzar guardado de datos críticos
        try {
            await Promise.all([
                // Aquí forzaríamos guardado de todos los servicios singleton
                new Promise(resolve => setTimeout(resolve, 1000)) // Placeholder
            ]);
        } catch (error) {
            Logger.warn('Error saving persistence data:', error);
        }
    }
});

// Registrar todas las tareas de shutdown
shutdownTasks.forEach(task => errorHandler.registerShutdownTask(task));

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    FRONTEND_URL
].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

const PORT = process.env.PORT || 3001;
const BOT_NAME = process.env.BOT_NAME || 'web-bot';
const DEBUG = process.env.DEBUG === 'true';

const io = new SocketServer(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Health check (MUST be registered before the SPA catch-all wildcard)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize broadcast scheduler (JSON based)
import BroadcastSchedulerService from './services/broadcastSchedulerService';
const broadcastScheduler = BroadcastSchedulerService.getInstance();

// Initialize Firestore broadcast service (Dashboard based)
import FirestoreBroadcastService from './services/firestoreBroadcastService';
const firestoreBroadcast = FirestoreBroadcastService.getInstance();

// Initialize Daily Reminder Service
import { DailyReminderService } from './services/dailyReminderService';
const dailyReminderService = DailyReminderService.getInstance();


// Ready to listen

// Forward scheduler events to Socket.IO
broadcastScheduler.on('campaign:auto-started', (data) => {
    Logger.info('[Server] Broadcast campaign auto-started:', data.name);
    io.emit('broadcast:campaign-started', data);
});

broadcastScheduler.on('campaign:auto-start-failed', (data) => {
    Logger.error('[Server] Broadcast campaign auto-start failed:', { name: data.name, error: data.error });
    io.emit('broadcast:campaign-failed', data);
});

// Start the JSON scheduler
broadcastScheduler.start()
    .then(() => Logger.info('[Server] Broadcast scheduler initialized'))
    .catch(err => Logger.warn('[Server] Broadcast scheduler failed to start:', err.message));

// Start the Firestore worker
firestoreBroadcast.start(10000); // Check every 10 seconds for more responsiveness
Logger.info('[Server] Firestore Broadcast worker initialized');

// Start the Daily Reminder scheduler
dailyReminderService.startScheduler()
    .then(() => Logger.info('[Server] Daily Reminder scheduler initialized'))
    .catch(err => Logger.warn('[Server] Daily Reminder scheduler failed to start:', err.message));

// Serve static files from the React frontend app
const path = require('path');
const staticPath = path.join(__dirname, '../../web/dist');

// Serve static files
app.use(express.static(staticPath));

// Handle SPA routing: serve index.html for any unknown route NOT starting with /api
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }

    const indexPath = path.join(staticPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback for dev mode or missing build
        res.send('API running. Frontend build not found at ' + staticPath);
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    Logger.info('Client connected:', socket.id);

    const botService = BotService.getInstance();

    // Send current state on connect
    socket.emit('connection:status', botService.getConnectionStatus());

    const currentQR = botService.getCurrentQR();
    if (currentQR) {
        socket.emit('qr', currentQR);
    }

    // Send connection health on connect
    try {
        const health = botService.getConnectionHealth();
        socket.emit('connection:health', health);
    } catch (_e) { /* ignore */ }

    // Typing indicators (FIX: properly await async calls)
    socket.on('typing:start', async ({ jid }) => {
        try {
            await botService.sendPresenceUpdate(jid, 'composing');
        } catch (error) {
            Logger.error('Error sending typing start:', error);
        }
    });

    socket.on('typing:stop', async ({ jid }) => {
        try {
            await botService.sendPresenceUpdate(jid, 'paused');
        } catch (error) {
            Logger.error('Error sending typing stop:', error);
        }
    });

    // Session control via Socket.IO
    socket.on('session:disconnect', async () => {
        try {
            await botService.disconnect();
            Logger.info('[Socket] Session disconnected by client');
        } catch (error) {
            Logger.error('[Socket] Error disconnecting session:', error);
            socket.emit('session:error', { error: 'Failed to disconnect' });
        }
    });

    socket.on('session:reconnect', async () => {
        try {
            await botService.reconnect();
            Logger.info('[Socket] Session reconnect requested by client');
        } catch (error) {
            Logger.error('[Socket] Error reconnecting session:', error);
            socket.emit('session:error', { error: 'Failed to reconnect' });
        }
    });

    socket.on('disconnect', () => {
        Logger.info('Client disconnected:', socket.id);
    });
});

// Initialize persistence layer
initializePersistence()
    .then(() => Logger.info('[Server] Persistence layer initialized'))
    .catch(err => Logger.error('[Server] Error initializing persistence:', err));

// Initialize backend repositories
initializeRepositories()
    .then(() => Logger.info('[Server] Backend repositories initialized'))
    .catch(err => Logger.error('[Server] Error initializing repositories:', err));

// Configure ErrorHandler with servers
errorHandler.setServers(httpServer, io);

// Prepare bot service (initialize only after server is successfully listening)
const botService = BotService.getInstance();
botService.setSocketServer(io);

// Ready to listen
httpServer.listen(PORT, () => {
    Logger.info(`Server running on http://localhost:${PORT}`);
    Logger.info(`Frontend URL: ${FRONTEND_URL}`);
    Logger.info(`Bot name: ${BOT_NAME}`);
    Logger.info('[Server] Error Handler configured with graceful shutdown');

    // Initialize bot only when HTTP server is up.
    // This prevents touching auth/session state when startup fails (e.g. EADDRINUSE).
    botService.initialize({
        name: BOT_NAME,
        usePairingCode: false,
        debug: DEBUG
    }).catch(err => {
        errorHandler.handleError(err, {
            component: 'BotService',
            operation: 'initialize'
        });
    });
});

httpServer.on('error', (error: any) => {
    if (error?.code === 'EADDRINUSE') {
        Logger.error(`[Server] Port ${PORT} is already in use. Avoid running multiple server instances.`);
        process.exit(1);
    }
});

export { app, httpServer, io };
