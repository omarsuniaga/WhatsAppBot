/**
 * ThemeContext - Dark/Light mode state management
 * Persists theme preference in localStorage AND Firebase for cross-device sync
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { userConfigService } from '../services/firestore/userConfigService';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'app-theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [theme, setThemeState] = useState<Theme>(() => {
        // Check localStorage first for instant load
        const saved = localStorage.getItem(THEME_KEY) as Theme | null;
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
        // Check system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    const [firebaseSynced, setFirebaseSynced] = useState(false);

    // Load from Firebase when user is authenticated
    useEffect(() => {
        if (!currentUser) return;

        const loadFromFirebase = async () => {
            try {
                const userConfig = await userConfigService.getUserConfig(currentUser.uid);

                if (userConfig?.theme) {
                    // Firebase has a preference, use it
                    setThemeState(userConfig.theme);
                    localStorage.setItem(THEME_KEY, userConfig.theme);
                    console.log('✅ Theme loaded from Firebase:', userConfig.theme);
                } else {
                    // No Firebase config yet, sync current localStorage to Firebase
                    await userConfigService.syncFromLocalStorage(currentUser.uid);
                }

                setFirebaseSynced(true);
            } catch (error) {
                console.error('Error loading theme from Firebase:', error);
                // Continue with localStorage value
                setFirebaseSynced(true);
            }
        };

        loadFromFirebase();
    }, [currentUser]);

    // Apply theme to document and sync to storage
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Save to localStorage immediately
        localStorage.setItem(THEME_KEY, theme);

        // Save to Firebase if user is authenticated and initial sync is done
        if (currentUser && firebaseSynced) {
            userConfigService.updateTheme(currentUser.uid, theme).catch(error => {
                console.error('Error saving theme to Firebase:', error);
                // Continue anyway - localStorage is the fallback
            });
        }
    }, [theme, currentUser, firebaseSynced]);

    const toggleTheme = () => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
