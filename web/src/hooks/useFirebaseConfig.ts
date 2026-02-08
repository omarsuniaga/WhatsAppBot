/**
 * useFirebaseConfig Hook
 * Custom hook that syncs state with both localStorage and Firebase
 * Provides cross-device sync while maintaining offline fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userConfigService, UserConfig } from '../services/firestore/userConfigService';

type ConfigKey = keyof Pick<UserConfig, 'knowledgeConfig' | 'escalationConfig' | 'broadcastConfig'>;

/**
 * Hook to manage configuration that syncs with Firebase
 * @param configKey - Key in UserConfig (e.g., 'knowledgeConfig')
 * @param localStorageKey - Key for localStorage fallback
 * @param defaultValue - Default value if nothing is found
 * @returns [value, setValue, loading]
 */
export function useFirebaseConfig<T>(
    configKey: ConfigKey,
    localStorageKey: string,
    defaultValue: T
): [T, (value: T | ((prev: T) => T)) => Promise<void>, boolean] {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);

    // Initialize from localStorage for instant load
    const [value, setValueState] = useState<T>(() => {
        try {
            const item = localStorage.getItem(localStorageKey);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    // Load from Firebase when user authenticates
    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const loadFromFirebase = async () => {
            try {
                const userConfig = await userConfigService.getUserConfig(currentUser.uid);

                if (userConfig && userConfig[configKey]) {
                    // Firebase has data, use it
                    const firebaseValue = userConfig[configKey] as T;
                    setValueState(firebaseValue);
                    localStorage.setItem(localStorageKey, JSON.stringify(firebaseValue));
                    console.log(`✅ ${configKey} loaded from Firebase`);
                } else {
                    // No Firebase data, sync localStorage to Firebase
                    const localValue = localStorage.getItem(localStorageKey);
                    if (localValue) {
                        await userConfigService.updateUserConfig(currentUser.uid, {
                            [configKey]: JSON.parse(localValue)
                        });
                    }
                }
            } catch (error) {
                console.error(`Error loading ${configKey} from Firebase:`, error);
            } finally {
                setLoading(false);
            }
        };

        loadFromFirebase();
    }, [currentUser, configKey, localStorageKey]);

    // Update function that saves to both localStorage and Firebase
    const setValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;

        // Update local state
        setValueState(valueToStore);

        // Save to localStorage immediately
        try {
            localStorage.setItem(localStorageKey, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error saving to localStorage:`, error);
        }

        // Save to Firebase if authenticated
        if (currentUser) {
            try {
                await userConfigService.updateUserConfig(currentUser.uid, {
                    [configKey]: valueToStore
                });
                console.log(`✅ ${configKey} saved to Firebase`);
            } catch (error) {
                console.error(`Error saving ${configKey} to Firebase:`, error);
                // Don't throw - localStorage is the fallback
            }
        }
    }, [value, currentUser, configKey, localStorageKey]);

    return [value, setValue, loading];
}
