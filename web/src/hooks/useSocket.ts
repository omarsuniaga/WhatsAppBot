/**
 * useSocket Hook - DISABLED
 * 
 * Socket.io is disabled since we migrated to Firebase direct connections.
 * Firestore subscriptions handle real-time updates instead.
 * 
 * This hook returns no-op functions to maintain API compatibility.
 */

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Enable socket for development and production
const SOCKET_ENABLED = true;

// Use explicit WS URL if active (bypassing proxy), otherwise relative
const SOCKET_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '/';

// SINGLETON INSTANCE
let socketInstance: Socket | null = null;

const getSocket = () => {
    if (!SOCKET_ENABLED) return null;

    if (!socketInstance) {
        console.log('🔌 Initializing Singleton Socket.io connection to:', SOCKET_URL);
        socketInstance = io(SOCKET_URL, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10, // Increased attempts
            reconnectionDelay: 2000,
            autoConnect: true
        });

        socketInstance.on('connect', () => {
            console.log('✅ Socket.io Connected:', socketInstance?.id);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('❌ Socket.io Disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Secret: if server disconnects us, we must manually reconnect
                socketInstance?.connect();
            }
        });

        socketInstance.on('connect_error', (error) => {
            // Only log first few errors to avoid console spam
            const attempts = (socketInstance as any)?._reconnectionAttempts ?? 0;
            if (attempts <= 2) {
                console.warn('⚠️ Socket.io Connection Error:', error.message || error);
            }
        });
    }
    return socketInstance;
};

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(getSocket()?.connected || false);
    const socket = getSocket();

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // SYNC INITIAL STATE
        setIsConnected(socket.connected);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [socket]);

    const startTyping = useCallback((jid: string) => {
        socket?.emit('typing:start', { jid });
    }, [socket]);

    const stopTyping = useCallback((jid: string) => {
        socket?.emit('typing:stop', { jid });
    }, [socket]);

    return {
        socket,
        isConnected,
        startTyping,
        stopTyping,
        isEnabled: SOCKET_ENABLED
    };
};
