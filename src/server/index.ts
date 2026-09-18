import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';

import routes from './routes';
import BotService from './services/botService';
import { initializePersistence } from './persistence';
import { initializeRepositories } from '../../backend/src/repos';
import ReEngagementService from '../modules/re-engagement/application/ReEngagementService';

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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    const botService = BotService.getInstance();

    // Send current state on connect
    socket.emit('connection:status', botService.getConnectionStatus());

    const currentQR = botService.getCurrentQR();
    if (currentQR) {
        socket.emit('qr', currentQR);
    }

    // Typing indicators
    socket.on('typing:start', ({ jid }) => {
        try {
            botService.sendPresenceUpdate(jid, 'composing');
        } catch (error) {
            console.error('Error sending typing start:', error);
        }
    });

    socket.on('typing:stop', ({ jid }) => {
        try {
            botService.sendPresenceUpdate(jid, 'paused');
        } catch (error) {
            console.error('Error sending typing stop:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Initialize persistence layer
initializePersistence()
    .then(() => console.log('[Server] Persistence layer initialized'))
    .catch(err => console.error('[Server] Error initializing persistence:', err));

// Initialize backend repositories
initializeRepositories()
    .then(() => console.log('[Server] Backend repositories initialized'))
    .catch(err => console.error('[Server] Error initializing repositories:', err));

// Initialize bot service
const botService = BotService.getInstance();
botService.setSocketServer(io);
botService.initialize({
    name: BOT_NAME,
    usePairingCode: false,
    debug: DEBUG
}).catch(err => console.error('Error initializing bot service:', err));

// Start the re-engagement silence sweep (Fase D: docs/SPEC_CONVERSACION_GUIADA.md)
// Only queues suggestions for human approval — never sends anything itself.
ReEngagementService.getInstance().start();

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`Bot name: ${BOT_NAME}`);
});

export { app, httpServer, io };
