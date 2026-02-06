import BotService from './botService';

export class ContactService {
    private static instance: ContactService;

    static getInstance(): ContactService {
        if (!ContactService.instance) {
            ContactService.instance = new ContactService();
        }
        return ContactService.instance;
    }

    /**
     * Get enhanced contact information with better name resolution
     */
    async getContactInfo(jid: string): Promise<{
        name: string;
        phoneNumber: string;
        profilePicUrl?: string;
        isBusiness?: boolean;
        isWAContact?: boolean;
    }> {
        const botService = BotService.getInstance();
        const store = botService.getStore();
        
        if (!store) {
            return this.getBasicInfo(jid);
        }

        const phoneNumber = jid.split('@')[0];
        let bestName = phoneNumber;
        let profilePicUrl: string | undefined;
        let isBusiness = false;
        let isWAContact = false;

        // Try multiple sources for contact information
        const possibleJids = [
            jid,
            `${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@c.us`,
            `${phoneNumber}@lid`
        ];

        // Check contacts store
        if (store.contacts) {
            for (const tryJid of possibleJids) {
                const contact = store.contacts[tryJid];
                if (contact) {
                    bestName = contact.name || contact.pushName || contact.notify || 
                              contact.verifiedName || contact.formattedName || 
                              bestName;
                    profilePicUrl = contact.profilePicUrl || profilePicUrl;
                    isBusiness = contact.isBusiness || isBusiness;
                    isWAContact = contact.isWAContact || isWAContact;
                    break;
                }
            }
        }

        // Check chats store for additional info
        if (store.chats) {
            for (const tryJid of possibleJids) {
                const chat = store.chats[tryJid];
                if (chat) {
                    bestName = chat.name || chat.subject || chat.pushName || 
                              chat.verifiedName || chat.formattedName || 
                              bestName;
                    break;
                }
            }
        }

        // Get profile picture if not found
        if (!profilePicUrl) {
            try {
                const picUrl = await botService.getProfilePictureUrl(jid);
                profilePicUrl = picUrl || undefined;
            } catch (error) {
                // Profile picture might not be available
            }
        }

        return {
            name: bestName,
            phoneNumber,
            profilePicUrl,
            isBusiness,
            isWAContact
        };
    }

    /**
     * Get basic contact info when store is not available
     */
    private getBasicInfo(jid: string): {
        name: string;
        phoneNumber: string;
    } {
        const phoneNumber = jid.split('@')[0];
        return {
            name: `+${phoneNumber}`,
            phoneNumber
        };
    }

    /**
     * Search contacts by name or phone number
     */
    async searchContacts(query: string): Promise<Array<{
        jid: string;
        name: string;
        phoneNumber: string;
        profilePicUrl?: string;
    }>> {
        const botService = BotService.getInstance();
        const store = botService.getStore();
        
        if (!store) return [];

        const results: Array<{
            jid: string;
            name: string;
            phoneNumber: string;
            profilePicUrl?: string;
        }> = [];

        const searchLower = query.toLowerCase();

        // Search in contacts
        if (store.contacts) {
            for (const [jid, contact] of Object.entries(store.contacts)) {
                if (jid === 'status@broadcast') continue;
                
                const phoneNumber = jid.split('@')[0];
                const contactObj = contact as any; // Type assertion for contact object
                const name = contactObj.name || contactObj.pushName || contactObj.notify || `+${phoneNumber}`;
                
                if (name.toLowerCase().includes(searchLower) || 
                    phoneNumber.includes(query) ||
                    jid.toLowerCase().includes(searchLower)) {
                    results.push({
                        jid,
                        name,
                        phoneNumber,
                        profilePicUrl: contactObj.profilePicUrl
                    });
                }
            }
        }

        // Search in chats if not enough results
        if (results.length < 10 && store.chats) {
            const chatsMap = store.chats;
            let allChats: any[] = [];
            
            if (typeof chatsMap.all === 'function') allChats = chatsMap.all();
            else if (chatsMap instanceof Map) allChats = Array.from(chatsMap.values());
            else if (typeof chatsMap.toJSON === 'function') allChats = Object.values(chatsMap.toJSON());
            else if (typeof chatsMap === 'object') allChats = Object.values(chatsMap);

            for (const chat of allChats) {
                if (!chat?.id || chat.id === 'status@broadcast') continue;
                
                const phoneNumber = chat.id.split('@')[0];
                const name = chat.name || chat.subject || `+${phoneNumber}`;
                
                if (name.toLowerCase().includes(searchLower) || 
                    phoneNumber.includes(query)) {
                    // Avoid duplicates
                    if (!results.find(r => r.jid === chat.id)) {
                        results.push({
                            jid: chat.id,
                            name,
                            phoneNumber
                        });
                    }
                }
            }
        }

        return results.slice(0, 20); // Limit results
    }

    /**
     * Get all contacts with enhanced information
     */
    async getAllContacts(): Promise<Array<{
        jid: string;
        name: string;
        phoneNumber: string;
        profilePicUrl?: string;
        isBusiness?: boolean;
        isGroup?: boolean;
    }>> {
        const botService = BotService.getInstance();
        const store = botService.getStore();
        
        if (!store) return [];

        const contacts: Array<{
            jid: string;
            name: string;
            phoneNumber: string;
            profilePicUrl?: string;
            isBusiness?: boolean;
            isGroup?: boolean;
        }> = [];

        // Get from contacts store
        if (store.contacts) {
            for (const [jid, contact] of Object.entries(store.contacts)) {
                if (jid === 'status@broadcast') continue;
                
                const phoneNumber = jid.split('@')[0];
                const contactObj = contact as any; // Type assertion for contact object
                const name = contactObj.name || contactObj.pushName || contactObj.notify || `+${phoneNumber}`;
                
                contacts.push({
                    jid,
                    name,
                    phoneNumber,
                    profilePicUrl: contactObj.profilePicUrl,
                    isBusiness: contactObj.isBusiness,
                    isGroup: jid.includes('@g.us')
                });
            }
        }

        // Get from chats store for additional contacts
        if (store.chats) {
            const chatsMap = store.chats;
            let allChats: any[] = [];
            
            if (typeof chatsMap.all === 'function') allChats = chatsMap.all();
            else if (chatsMap instanceof Map) allChats = Array.from(chatsMap.values());
            else if (typeof chatsMap.toJSON === 'function') allChats = Object.values(chatsMap.toJSON());
            else if (typeof chatsMap === 'object') allChats = Object.values(chatsMap);

            for (const chat of allChats) {
                if (!chat?.id || chat.id === 'status@broadcast') continue;
                
                // Skip if already added
                if (contacts.find(c => c.jid === chat.id)) continue;
                
                const phoneNumber = chat.id.split('@')[0];
                const name = chat.name || chat.subject || chat.pushName || `+${phoneNumber}`;
                
                contacts.push({
                    jid: chat.id,
                    name,
                    phoneNumber,
                    isGroup: chat.id.includes('@g.us')
                });
            }
        }

        return contacts;
    }
}

export default ContactService;
