import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';

import routes from './routes';
import BotService from './services/botService';

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3001;
const BOT_NAME = process.env.BOT_NAME || 'web-bot';
const DEBUG = process.env.DEBUG === 'true';

const io = new SocketServer(httpServer, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors({
    origin: FRONTEND_URL
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

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

// Initialize bot service
const botService = BotService.getInstance();
botService.setSocketServer(io);
botService.initialize({
    name: BOT_NAME,
    usePairingCode: false,
    debug: DEBUG
}).catch(err => console.error('Error initializing bot service:', err));

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Frontend URL: ${FRONTEND_URL}`);
    console.log(`Bot name: ${BOT_NAME}`);
});

export { app, httpServer, io };
