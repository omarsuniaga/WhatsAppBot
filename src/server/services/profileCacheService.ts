import BotService from './botService';

interface CacheEntry {
    url: string | null;
    expires: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

class ProfileCacheService {
    private static instance: ProfileCacheService;
    private cache: Map<string, CacheEntry>;
    private pendingRequests: Map<string, Promise<string | null>>;

    private constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
    }

    static getInstance(): ProfileCacheService {
        if (!ProfileCacheService.instance) {
            ProfileCacheService.instance = new ProfileCacheService();
        }
        return ProfileCacheService.instance;
    }

    /**
     * Get profile picture URL with caching
     */
    async getProfilePicUrl(jid: string): Promise<string | null> {
        // Check cache first
        const cached = this.cache.get(jid);
        if (cached && cached.expires > Date.now()) {
            return cached.url;
        }

        // Check if there's already a pending request for this JID
        const pending = this.pendingRequests.get(jid);
        if (pending) {
            return pending;
        }

        // Make a new request
        const request = this.fetchProfilePic(jid);
        this.pendingRequests.set(jid, request);

        try {
            const url = await request;

            // Cache the result
            this.cache.set(jid, {
                url,
                expires: Date.now() + CACHE_TTL_MS
            });

            return url;
        } finally {
            this.pendingRequests.delete(jid);
        }
    }

    private async fetchProfilePic(jid: string): Promise<string | null> {
        try {
            const botService = BotService.getInstance();
            return await botService.getProfilePictureUrl(jid);
        } catch (error) {
            console.error(`Failed to fetch profile pic for ${jid}:`, error);
            return null;
        }
    }

    /**
     * Get multiple profile pictures at once
     */
    async getMultipleProfilePics(jids: string[]): Promise<Map<string, string | null>> {
        const results = new Map<string, string | null>();
        const uncached: string[] = [];

        // Check cache for each JID
        for (const jid of jids) {
            const cached = this.cache.get(jid);
            if (cached && cached.expires > Date.now()) {
                results.set(jid, cached.url);
            } else {
                uncached.push(jid);
            }
        }

        // Fetch uncached JIDs in parallel (with limit to avoid overwhelming)
        if (uncached.length > 0) {
            const batchSize = 5;
            for (let i = 0; i < uncached.length; i += batchSize) {
                const batch = uncached.slice(i, i + batchSize);
                const promises = batch.map(async (jid) => {
                    const url = await this.getProfilePicUrl(jid);
                    results.set(jid, url);
                });
                await Promise.all(promises);
            }
        }

        return results;
    }

    /**
     * Invalidate cache for a specific JID
     */
    invalidate(jid: string): void {
        this.cache.delete(jid);
    }

    /**
     * Clear entire cache
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[ProfileCache] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; hits: number; expiredCount: number } {
        const now = Date.now();
        let expiredCount = 0;

        for (const [, entry] of this.cache) {
            if (entry.expires <= now) {
                expiredCount++;
            }
        }

        return {
            size: this.cache.size,
            hits: this.cache.size - expiredCount,
            expiredCount
        };
    }

    /**
     * Clean up expired entries
     */
    cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [jid, entry] of this.cache) {
            if (entry.expires <= now) {
                this.cache.delete(jid);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`[ProfileCache] Cleaned up ${removed} expired entries`);
        }
    }
}

export default ProfileCacheService;
