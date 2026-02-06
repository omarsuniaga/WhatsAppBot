/**
 * Authentication Context
 * Gestiona el estado de autenticación global
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    UserCredential
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<UserCredential>;
    register: (email: string, password: string) => Promise<UserCredential>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Suscribirse a cambios de autenticación
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);

            if (user) {
                console.log('✅ User authenticated:', user.email);
            } else {
                console.log('🔓 No user authenticated');
            }
        });

        // Cleanup
        return unsubscribe;
    }, []);

    const login = async (email: string, password: string): Promise<UserCredential> => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Login successful:', result.user.email);
            return result;
        } catch (error: any) {
            console.error('❌ Login error:', error.message);
            throw error;
        }
    };

    const register = async (email: string, password: string): Promise<UserCredential> => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            console.log('✅ Registration successful:', result.user.email);
            return result;
        } catch (error: any) {
            console.error('❌ Registration error:', error.message);
            throw error;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await signOut(auth);
            console.log('✅ Logout successful');
        } catch (error: any) {
            console.error('❌ Logout error:', error.message);
            throw error;
        }
    };

    const value: AuthContextType = {
        currentUser,
        loading,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
