/**
 * WhatsApp Protected Route
 * Verifica que la sesión de WhatsApp esté activa
 * Solo se usa para rutas que requieren WhatsApp
 */

import React from 'react';
import { useStore } from '../store';
import { QRLogin } from './auth/QRLogin';

interface WhatsAppProtectedRouteProps {
    children: React.ReactNode;
}

export const WhatsAppProtectedRoute: React.FC<WhatsAppProtectedRouteProps> = ({ children }) => {
    const { connectionStatus } = useStore();

    // Si WhatsApp no está conectado, mostrar QR
    if (connectionStatus !== 'connected') {
        return <QRLogin />;
    }

    // WhatsApp conectado, mostrar contenido
    return <>{children}</>;
};
