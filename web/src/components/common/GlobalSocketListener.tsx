import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useStore } from '../../store';
import type { Message, ConnectionStatus } from '../../types';

export const GlobalSocketListener = () => {
    const { socket } = useSocket();
    const {
        setQRCode,
        setConnectionStatus,
        setPairingCode,
        addMessage,
        updateChatWithNewMessage,
        updateChatFromServer
    } = useStore();

    // Throttle repeated logs: only log status/ready at most once per `LOG_COOLDOWN` ms
    const lastStatusRef = useRef<{ status?: ConnectionStatus; ts: number }>({ status: undefined, ts: 0 });
    const lastReadyRef = useRef<number>(0);
    const LOG_COOLDOWN = 3000; // milliseconds

    const handleConnectionStatus = useCallback((status: ConnectionStatus) => {
        const now = Date.now();
        const last = lastStatusRef.current;
        if (!(last.status === status && now - last.ts < LOG_COOLDOWN)) {
            // Only log when status changed or cooldown elapsed
            if (import.meta.env.DEV) console.log('Socket event: connection:status', status);
            lastStatusRef.current = { status, ts: now };
        }
        setConnectionStatus(status);
    }, [setConnectionStatus]);

    const handleReady = useCallback(() => {
        const now = Date.now();
        if (now - lastReadyRef.current > LOG_COOLDOWN) {
            if (import.meta.env.DEV) console.log('Socket event: ready');
            lastReadyRef.current = now;
        }
        setConnectionStatus('connected');
        setQRCode(null);
    }, [setConnectionStatus, setQRCode]);

    const handleAuthFailure = useCallback((data: any) => {
        if (import.meta.env.DEV) console.error('Socket event: auth_failure', data);
        setConnectionStatus('disconnected');
    }, [setConnectionStatus]);

    const handleQR = useCallback((qr: string) => {
        if (import.meta.env.DEV) console.log('Socket event: qr received');
        setQRCode(qr);
        setConnectionStatus('connecting');
    }, [setQRCode, setConnectionStatus]);

    const handlePairingCode = useCallback((code: string) => {
        if (import.meta.env.DEV) console.log('Socket event: pairing_code received');
        setPairingCode(code);
    }, [setPairingCode]);

    const handleNewMessage = useCallback((message: any) => {
        if (import.meta.env.DEV) console.log('Socket event: message:new', message?.id);
        const chatJid = message.jid || message.remoteJid || message.from;
        if (chatJid) {
            const normalizedMessage: Message = {
                ...message,
                remoteJid: chatJid
            };
            addMessage(chatJid, normalizedMessage);
            updateChatWithNewMessage(chatJid, normalizedMessage);
        }
    }, [addMessage, updateChatWithNewMessage]);

    const handleChatUpdated = useCallback((data: any) => {
        if (import.meta.env.DEV) console.log('Socket event: chat:updated', data?.jid);
        updateChatFromServer(data);
    }, [updateChatFromServer]);

    const handleBotResponse = useCallback((data: any) => {
        if (import.meta.env.DEV) console.log('Socket event: bot:response', data?.jid);
    }, []);

    const handleNewAlert = useCallback((alert: any) => {
        if (import.meta.env.DEV) console.log('Socket event: alert:new', alert?.id);
    }, []);

    const handleSyncHistory = useCallback((data: any) => {
        if (import.meta.env.DEV) console.log('Socket event: sync:history', data);
    }, []);

    const handleSyncChats = useCallback((data: any[]) => {
        if (import.meta.env.DEV) console.log('Socket event: sync:chats', data?.length, 'chats');
    }, []);

    /**
     * Attach listeners only when socket changes (rarely, since it's a singleton).
     * The socket reference is memoized in the useSocket hook as a singleton,
     * so this useEffect should execute only once on mount.
     */
    useEffect(() => {
        if (!socket) return;

        console.log('🎧 GlobalSocketListener: Attaching listeners');

        // Attach all listeners
        socket.on('connection:status', handleConnectionStatus);
        socket.on('ready', handleReady);
        socket.on('auth_failure', handleAuthFailure);
        socket.on('qr', handleQR);
        socket.on('pairing_code', handlePairingCode);
        socket.on('message:new', handleNewMessage);
        socket.on('chat:updated', handleChatUpdated);
        socket.on('bot:response', handleBotResponse);
        socket.on('alert:new', handleNewAlert);
        socket.on('sync:history', handleSyncHistory);
        socket.on('sync:chats', handleSyncChats);

        // Cleanup: detach all listeners when socket changes or component unmounts
        return () => {
            console.log('🎧 GlobalSocketListener: Detaching listeners');
            socket.off('connection:status', handleConnectionStatus);
            socket.off('ready', handleReady);
            socket.off('auth_failure', handleAuthFailure);
            socket.off('qr', handleQR);
            socket.off('pairing_code', handlePairingCode);
            socket.off('message:new', handleNewMessage);
            socket.off('chat:updated', handleChatUpdated);
            socket.off('bot:response', handleBotResponse);
            socket.off('alert:new', handleNewAlert);
            socket.off('sync:history', handleSyncHistory);
            socket.off('sync:chats', handleSyncChats);
        };
    }, [
        socket,
        handleConnectionStatus,
        handleReady,
        handleAuthFailure,
        handleQR,
        handlePairingCode,
        handleNewMessage,
        handleChatUpdated,
        handleBotResponse,
        handleNewAlert,
        handleSyncHistory,
        handleSyncChats
    ]);

    return null;
};
