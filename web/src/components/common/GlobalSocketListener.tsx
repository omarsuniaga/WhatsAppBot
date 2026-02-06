import { useEffect } from 'react';
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

    useEffect(() => {
        if (!socket) return;

        console.log('🎧 GlobalSocketListener: Attaching listeners');

        // Connection events
        socket.on('connection:status', (status: ConnectionStatus) => {
            console.log('Socket event: connection:status', status);
            setConnectionStatus(status);
        });

        socket.on('ready', () => {
            console.log('Socket event: ready');
            setConnectionStatus('connected');
            setQRCode(null);
        });

        socket.on('auth_failure', (data: any) => {
            console.error('Socket event: auth_failure', data);
            setConnectionStatus('disconnected');
        });

        socket.on('qr', (qr: string) => {
            console.log('Socket event: qr received');
            setQRCode(qr);
            setConnectionStatus('connecting');
        });

        socket.on('pairing_code', (code: string) => {
            console.log('Socket event: pairing_code received');
            setPairingCode(code);
        });

        // Chat events
        socket.on('message:new', (message: any) => {
            console.log('Socket event: message:new', message.id);
            // Use backend-provided 'jid' or fallback to remoteJid/from
            const chatJid = message.jid || message.remoteJid || message.from;
            if (chatJid) {
                // Ensure message object has standardized jid for store
                const normalizedMessage: Message = {
                    ...message,
                    remoteJid: chatJid
                };
                addMessage(chatJid, normalizedMessage);
                updateChatWithNewMessage(chatJid, normalizedMessage);
            }
        });

        socket.on('chat:updated', (data: any) => {
            console.log('Socket event: chat:updated', data.jid);
            updateChatFromServer(data);
        });

        socket.on('bot:response', (data: any) => {
            console.log('Socket event: bot:response', data.jid);
            // Bot responses usually come back as message:new too, 
            // but this helps debug or show AI processing status
        });

        // Alerts (Attendance/Automations)
        socket.on('alert:new', (alert: any) => {
            console.log('Socket event: alert:new', alert.id);
            // Optionally add to a local alerts notification system
        });

        // Sync events
        socket.on('sync:history', (data: any) => {
            console.log('Socket event: sync:history', data);
            // When history sync is received, it's a good time to re-fetch chats
            // For now, we rely on the next auto-refresh or manual refresh
        });

        socket.on('sync:chats', (data: any[]) => {
            console.log('Socket event: sync:chats', data.length, 'chats');
        });

        return () => {
            console.log('🎧 GlobalSocketListener: Detaching listeners');
            socket.off('connection:status');
            socket.off('ready');
            socket.off('auth_failure');
            socket.off('qr');
            socket.off('pairing_code');
            socket.off('message:new');
            socket.off('chat:updated');
            socket.off('bot:response');
            socket.off('alert:new');
            socket.off('sync:history');
            socket.off('sync:chats');
        };
    }, [socket, setQRCode, setConnectionStatus, setPairingCode, addMessage, updateChatWithNewMessage, updateChatFromServer]);

    return null; // This component does not render anything
};
