import { EventEmitter } from 'events';
import pino, { Logger } from 'pino'
// @ts-ignore
import NodeCache from 'node-cache'
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    Browsers,
    proto,
    WAMessageContent,
    WAMessageKey
} from '@whiskeysockets/baileys'
import makeInMemoryStore from './store';
import { readFileSync, existsSync, rmSync } from 'fs';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

import mime from 'mime-types';

import utils from './utils';
import { join } from 'path';



interface Args {
    debug?: boolean;
    [key: string]: any;  // Define the shape of this object as needed
}

type SendMessageOptions = {
    keyword?: string,
    refresh?: string,
    answer?: string,
    options: {
        capture?: boolean
        child?: any
        delay?: number
        nested?: any[]
        keyword?: any
        callback?: boolean
        buttons?: { body: string }[]
        media?: string
    },
    refSerialize?: string
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const msgRetryCounterCache = new NodeCache()


export class BaileysClass extends EventEmitter {
    private vendor: any;
    public store: any;
    private globalVendorArgs: Args;
    private sock: any;
    private NAME_DIR_SESSION: string;
    private plugin: boolean;

    constructor(args = {}) {

        super()
        this.vendor = null;
        this.store = null;
        this.globalVendorArgs = { name: `bot`, usePairingCode: false, phoneNumber: null, gifPlayback: false, dir: './', ...args };
        this.NAME_DIR_SESSION = `${this.globalVendorArgs.dir}${this.globalVendorArgs.name}_sessions`;
        this.initBailey();

        // is plugin?
        const err = new Error();
        const stack = err.stack;
        this.plugin = stack?.includes('createProvider') ?? false;

    }

    getMessage = async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
        if (this.store) {
            const msg = await this.store.loadMessage(key.remoteJid, key.id)
            return msg?.message || undefined
        }
        // only if store is present
        return proto.Message.fromObject({})
    }

    getInstance = (): any => this.vendor;

    initBailey = async (): Promise<void> => {

        const logger: Logger = pino({ level: this.globalVendorArgs.debug ? 'debug' : 'fatal' })
        const { state, saveCreds } = await useMultiFileAuthState(this.NAME_DIR_SESSION);
        const { version, isLatest } = await fetchLatestBaileysVersion()

        if (this.globalVendorArgs.debug) console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

        this.store = makeInMemoryStore({ logger })
        const storePath = `${this.NAME_DIR_SESSION}/baileys_store.json`;
        if (existsSync(storePath)) {
            this.store.readFromFile(storePath);
        }
        setInterval(() => {
            this.store.writeToFile(storePath);
        }, 10_000);

        try {
            this.setUpBaileySock({ version, logger, state, saveCreds });
        } catch (e) {
            this.emit('auth_failure', e);
        }
    }

    setUpBaileySock = async ({ version, logger, state, saveCreds }) => {
        this.sock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            browser: Browsers.macOS('Desktop'),
            msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            getMessage: this.getMessage,
            syncFullHistory: true,
        })

        this.store?.bind(this.sock.ev)

        if (this.globalVendorArgs.usePairingCode) {
            if (this.globalVendorArgs.phoneNumber) {
                await this.sock.waitForConnectionUpdate((update) => !!update.qr)
                const code = await this.sock.requestPairingCode(this.globalVendorArgs.phoneNumber)
                if (this.plugin) {
                    this.emit('require_action', {
                        instructions: [
                            `Acepta la notificación del WhatsApp ${this.globalVendorArgs.phoneNumber} en tu celular 👌`,
                            `El token para la vinculación es: ${code}`,
                            `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                        ],
                    })
                } else {
                    this.emit('pairing_code', code);
                }
            } else {
                this.emit('auth_failure', 'phoneNumber is empty')
            }
        }

        this.sock.ev.on('connection.update', this.handleConnectionUpdate);
        this.sock.ev.on('creds.update', saveCreds)
    }

    handleConnectionUpdate = async (update: any): Promise<void> => {
        const { connection, lastDisconnect, qr } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (connection === 'close') {
            if (statusCode !== DisconnectReason.loggedOut) this.initBailey();
            if (statusCode === DisconnectReason.loggedOut) await this.clearSessionAndRestart();
        }

        if (connection === 'open') {
            this.vendor = this.sock;
            this.initBusEvents(this.sock);
            this.emit('ready', true);
        }

        if (qr && !this.globalVendorArgs.usePairingCode) {
            if (this.plugin) this.emit('require_action', {
                instructions: [
                    `Debes escanear el QR Code 👌 ${this.globalVendorArgs.name}.qr.png`,
                    `Recuerda que el QR se actualiza cada minuto `,
                    `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                ],
            })
            this.emit('qr', qr);
            if (this.plugin) await utils.baileyGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
        }
    }

    clearSessionAndRestart = async (): Promise<void> => {
        const PATH_BASE = join(process.cwd(), this.NAME_DIR_SESSION);

        // 1. Close socket to release locks
        try {
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = undefined;
                this.vendor = undefined;
            }
        } catch (e) {
            console.error('Error closing socket:', e);
        }

        // 2. Wait for locks to release
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Delete session directory with retry
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (existsSync(PATH_BASE)) {
                    rmSync(PATH_BASE, { recursive: true, force: true });
                }
                console.log(`Session cleared successfully on attempt ${i + 1}`);
                break;
            } catch (error: any) {
                console.error(`Error clearing session (attempt ${i + 1}):`, error.message);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        this.initBailey();
    }

    busEvents = (): any[] => [
        {
            event: 'messages.upsert',
            func: ({ messages, type }) => {
                // Ignore notify messages
                if (type !== 'notify') return

                const [messageCtx] = messages;
                let payload = {
                    ...messageCtx,
                    body: messageCtx?.message?.extendedTextMessage?.text ?? messageCtx?.message?.conversation,
                    from: messageCtx?.key?.remoteJid,
                    type: 'text'
                };

                // Ignore pollUpdateMessage
                if (messageCtx.message?.pollUpdateMessage) return

                // Ignore broadcast messages
                if (payload.from === 'status@broadcast') return

                // Ignore messages from self
                if (payload?.key?.fromMe) return

                // Detect location
                if (messageCtx.message?.locationMessage) {
                    const { degreesLatitude, degreesLongitude } = messageCtx.message.locationMessage;
                    if (typeof degreesLatitude === 'number' && typeof degreesLongitude === 'number') {
                        payload = { ...payload, body: utils.generateRefprovider('_event_location_'), type: 'location' };
                    }
                }
                // Detect  media
                if (messageCtx.message?.imageMessage) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_media_'), type: 'image' };
                }

                // Detect  ectar file
                if (messageCtx.message?.documentMessage) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_document_'), type: 'file' };
                }

                // Detect voice note
                if (messageCtx.message?.audioMessage) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_voice_note_'), type: 'voice' };
                }

                // Check from user and group is valid 
                if (!utils.formatPhone(payload.from)) {
                    return
                }

                const btnCtx = payload?.message?.buttonsResponseMessage?.selectedDisplayText;
                if (btnCtx) payload.body = btnCtx;

                const listRowId = payload?.message?.listResponseMessage?.title;
                if (listRowId) payload.body = listRowId;

                payload.from = utils.formatPhone(payload.from, this.plugin);
                this.emit('message', payload);
            },
        },
        {
            event: 'messages.update',
            func: async (message) => {
                for (const { key, update } of message) {
                    if (update.pollUpdates) {
                        const pollCreation = await this.getMessage(key)
                        if (pollCreation) {
                            const pollMessage = await getAggregateVotesInPollMessage({
                                message: pollCreation,
                                pollUpdates: update.pollUpdates,
                            })
                            const [messageCtx] = message;

                            let payload = {
                                ...messageCtx,
                                body: pollMessage.find(poll => poll.voters.length > 0)?.name || '',
                                from: utils.formatPhone(key.remoteJid, this.plugin),
                                voters: pollCreation,
                                type: 'poll'
                            };
                            this.emit('message', payload);
                        }
                    }
                }
            }
        },
        {
            event: 'messaging-history.set',
            func: (payload) => {
                this.emit('history_sync', payload);
            }
        },
        {
            event: 'chats.upsert',
            func: (chats) => {
                this.emit('chats_upsert', chats);
            }
        }
    ]

    initBusEvents = (_sock: any): void => {
        this.vendor = _sock;
        const listEvents = this.busEvents();

        for (const { event, func } of listEvents) {
            this.vendor.ev.on(event, func);
        }
    }

    /**
     * Send Media
     * @alpha
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'https://dominio.com/imagen.jpg' | 'img/imagen.jpg')
     */

    sendMedia = async (number: string, mediaUrl: string, text: string): Promise<any> => {
        try {
            const fileDownloaded = await utils.generalDownload(mediaUrl);
            const mimeType = mime.lookup(fileDownloaded);

            if (typeof mimeType === 'string' && mimeType.includes('image')) return this.sendImage(number, fileDownloaded, text);
            if (typeof mimeType === 'string' && mimeType.includes('video')) return this.sendVideo(number, fileDownloaded, text);
            if (typeof mimeType === 'string' && mimeType.includes('audio')) {
                const fileOpus = await utils.convertAudio(fileDownloaded);
                return this.sendAudio(number, fileOpus);
            }

            return this.sendFile(number, fileDownloaded)
        } catch (error) {
            console.error(`Error enviando media: ${error}`);
            throw error;
        }
    }

    /**
     * Send image
     * @param {*} number
     * @param {*} filePath
     * @param {*} text
     * @returns
     */
    sendImage = async (number: string, filePath: string, text: string): Promise<any> => {
        const numberClean = utils.formatPhone(number)
        return this.vendor.sendMessage(numberClean, {
            image: readFileSync(filePath),
            caption: text ?? '',
        })
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number: string, filePath: string, text: string): Promise<any> => {
        const numberClean = utils.formatPhone(number)
        return this.vendor.sendMessage(numberClean, {
            video: readFileSync(filePath),
            caption: text,
            gifPlayback: this.globalVendorArgs.gifPlayback,
        })
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number: string, audioUrl: string): Promise<any> => {
        const numberClean = utils.formatPhone(number)
        return this.vendor.sendMessage(numberClean, {
            audio: { url: audioUrl },
            ptt: true,
        })
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number: string, message: string): Promise<any> => {
        const numberClean = utils.formatPhone(number)
        return this.vendor.sendMessage(numberClean, { text: message })
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number: string, filePath: string): Promise<any> => {
        const numberClean = utils.formatPhone(number)
        const mimeType = mime.lookup(filePath);
        const fileName = filePath.split('/').pop();
        return this.vendor.sendMessage(numberClean, {
            document: { url: filePath },
            mimetype: mimeType,
            fileName: fileName,
        })
    }

    /**
     * @deprecated
     * @param {string} number
     * @param {string} text
     * @param {string} footer
     * @param {Array} buttons
     * @example await sendMessage("+XXXXXXXXXXX", "Your Text", "Your Footer", [{"buttonId": "id", "buttonText": {"displayText": "Button"}, "type": 1}])
     */

    sendButtons = async (number: string, text: string, buttons: any[]): Promise<any> => {
        const numberClean = utils.formatPhone(number)

        const templateButtons = buttons.map((btn, i) => ({
            buttonId: `id-btn-${i}`,
            buttonText: { displayText: btn.body },
            type: 1,
        }));

        const buttonMessage = {
            text,
            footer: '',
            buttons: templateButtons,
            headerType: 1,
        };

        return this.vendor.sendMessage(numberClean, buttonMessage)
    }

    /**
    *
    * @param {string} number
    * @param {string} text
    * @param {string} footer
    * @param {Array} poll
    * @example await sendMessage("+XXXXXXXXXXX", "Your Text", "Your Footer", [{"buttonId": "id", "buttonText": {"displayText": "Button"}, "type": 1}])
    */

    sendPoll = async (number: string, text: string, poll: any): Promise<boolean> => {
        const numberClean = utils.formatPhone(number)

        if (poll.options.length < 2) return false

        const pollMessage = {
            name: text,
            values: poll.options,
            selectableCount: 1
        };
        return this.vendor.sendMessage(numberClean, { poll: pollMessage })
    }

    /**
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */


    sendMessage = async (numberIn: string, message: string, options: SendMessageOptions): Promise<any> => {
        const number = utils.formatPhone(numberIn);

        if (options.options.buttons?.length) {
            return this.sendPoll(number, message, {
                options: options.options.buttons.map((btn, i) => (btn.body)) ?? [],
            })
        }
        if (options.options?.media) return this.sendMedia(number, options.options.media, message)
        return this.sendText(number, message)
    }

    /**
     * @param {string} remoteJid
     * @param {string} latitude
     * @param {string} longitude
     * @param {any} messages
     * @example await sendLocation("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "xx.xxxx", "xx.xxxx", messages)
     */

    sendLocation = async (remoteJid: string, latitude: string, longitude: string, messages: any = null): Promise<{ status: string }> => {
        await this.vendor.sendMessage(
            remoteJid,
            {
                location: {
                    degreesLatitude: latitude,
                    degreesLongitude: longitude,
                },
            },
            { quoted: messages }
        );

        return { status: 'success' }
    }

    /**
     * @param {string} remoteJid
     * @param {string} contactNumber
     * @param {string} displayName
     * @param {any} messages - optional
     * @example await sendContact("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "+xxxxxxxxxxx", "Robin Smith", messages)
     */

    sendContact = async (remoteJid: string, contactNumber: string, displayName: string, messages: any = null): Promise<{ status: string }> => {

        const cleanContactNumber = contactNumber.replace(/ /g, '');
        const waid = cleanContactNumber.replace('+', '');

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${displayName}\n` +
            'ORG:Ashoka Uni;\n' +
            `TEL;type=CELL;type=VOICE;waid=${waid}:${cleanContactNumber}\n` +
            'END:VCARD';

        await this.vendor.sendMessage(
            remoteJid,
            {
                contacts: {
                    displayName: displayName,
                    contacts: [{ vcard }],
                },
            },
            { quoted: messages }
        );

        return { status: 'success' }
    }

    /**
     * @param {string} remoteJid
     * @param {string} WAPresence
     * @example await sendPresenceUpdate("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "recording")
     */
    sendPresenceUpdate = async (remoteJid: string, WAPresence: string): Promise<void> => {
        await this.vendor.sendPresenceUpdate(WAPresence, remoteJid);
    }

    /**
     * @param {string} remoteJid
     * @param {string} url
     * @param {object} stickerOptions
     * @param {any} messages - optional
     * @example await sendSticker("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "https://dn/image.png" || "https://dn/image.gif" || "https://dn/image.mp4", {pack: 'User', author: 'Me'}, messages)
     */

    sendSticker = async (remoteJid: string, url: string, stickerOptions: any, messages: any = null): Promise<void> => {
        const number = utils.formatPhone(remoteJid);
        const fileDownloaded = await utils.generalDownload(url);

        await this.vendor.sendMessage(number, {
            sticker: {
                url: fileDownloaded
            },
        }, { quoted: messages });
    }

    getProfilePictureUrl = async (jid: string): Promise<string | null> => {
        if (!this.vendor) return null;
        try {
            const url = await this.vendor.profilePictureUrl(jid, 'image');
            return url;
        } catch (error) {
            return null;
        }
    }

    fetchMessageHistory = async (jid: string, count: number = 50): Promise<any[]> => {
        if (!this.vendor || !this.store) {
            console.log('Vendor or store not available for fetchMessageHistory');
            return [];
        }

        const getFromStore = () => {
            const phoneNumber = jid.split('@')[0];
            const possibleJids = Array.from(new Set([
                jid,
                `${phoneNumber}@s.whatsapp.net`,
                `${phoneNumber}@lid`,
                `${phoneNumber}@c.us`,
            ]));

            for (const tryJid of possibleJids) {
                const storeMessages = this.store.messages[tryJid];
                if (storeMessages?.array?.length > 0) {
                    console.log(`Found ${storeMessages.array.length} messages for ${tryJid}`);
                    return storeMessages.array.slice(-count);
                }
            }
            return null;
        }

        // First try to get from store
        const fromStore = getFromStore();
        if (fromStore && fromStore.length > 0) {
            if (this.globalVendorArgs.debug) console.log(`Returning ${fromStore.length} messages from store for ${jid}`);
            return fromStore;
        }

        try {
            const canonicalJid = `${jid.split('@')[0]}@s.whatsapp.net`;
            if (this.globalVendorArgs.debug) console.log(`Attempting to fetch history for ${canonicalJid}`);

            // Try multiple approaches to fetch history

            // 1. Use chatModify to trigger history sync
            try {
                await this.vendor.chatModify(
                    { lastMessages: [{ key: { remoteJid: canonicalJid }, messageTimestamp: Math.floor(Date.now() / 1000) }], clear: false },
                    canonicalJid
                );
                if (this.globalVendorArgs.debug) console.log(`ChatModify sent for ${canonicalJid}`);
            } catch (chatModifyError) {
                if (this.globalVendorArgs.debug) console.log(`ChatModify failed for ${canonicalJid}:`, chatModifyError.message);
            }

            // 2. Try to use readMessages if available
            try {
                // Some versions of baileys support explicit message loading
                if (this.vendor.loadMessages) {
                    const loadedMessages = await this.vendor.loadMessages(canonicalJid, count);
                    if (loadedMessages && loadedMessages.length > 0) {
                        if (this.globalVendorArgs.debug) console.log(`Loaded ${loadedMessages.length} messages using loadMessages`);
                        return loadedMessages;
                    }
                }
            } catch (loadError) {
                if (this.globalVendorArgs.debug) console.log(`loadMessages failed:`, loadError.message);
            }

            // Wait for messages to sync
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased timeout

            // Check store again
            const syncedMessages = getFromStore();
            if (syncedMessages && syncedMessages.length > 0) {
                if (this.globalVendorArgs.debug) console.log(`Found ${syncedMessages.length} messages after sync for ${jid}`);
                return syncedMessages;
            }

            if (this.globalVendorArgs.debug) console.log(`No messages found for ${jid} after all attempts`);
            return [];

        } catch (error: any) {
            console.error(`Error in fetchMessageHistory for ${jid}:`, error.message);
            return getFromStore() || [];
        }
    }

    getMessagesFromStore = (jid: string, count: number = 50): any[] => {
        if (!this.store?.messages?.[jid]) return [];
        return this.store.messages[jid].array?.slice(-count) || [];
    }

    /**
     * Mark messages as read and send read receipts to WhatsApp
     * @param jid - Chat JID
     * @param messageKeys - Array of message keys to mark as read (optional, marks all if not provided)
     */
    markMessagesAsRead = async (jid: string, messageKeys?: WAMessageKey[]): Promise<boolean> => {
        if (!this.vendor) {
            console.log('Vendor not available for markMessagesAsRead');
            return false;
        }

        try {
            const canonicalJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;

            // Try multiple JID formats to find messages
            const phoneNumber = canonicalJid.split('@')[0];
            const possibleJids = [
                canonicalJid,
                `${phoneNumber}@s.whatsapp.net`,
                `${phoneNumber}@lid`,
                `${phoneNumber}@c.us`
            ];

            let messagesJid = canonicalJid;
            let messages: any[] = [];

            // Find messages in store using multiple JID formats
            for (const tryJid of possibleJids) {
                const storeMessages = this.store?.messages?.[tryJid]?.array;
                if (storeMessages && storeMessages.length > 0) {
                    messagesJid = tryJid;
                    messages = storeMessages;
                    break;
                }
            }

            if (messageKeys && messageKeys.length > 0) {
                // Mark specific messages as read
                await this.vendor.readMessages(messageKeys);
                if (this.globalVendorArgs.debug) console.log(`Marked ${messageKeys.length} messages as read for ${canonicalJid}`);

                // Update status in store for these specific messages
                const messageIdSet = new Set(messageKeys.map(k => k.id));
                messages.forEach((msg: any) => {
                    if (messageIdSet.has(msg.key?.id)) {
                        msg.status = 3; // 3 = read
                    }
                });
            } else {
                // Mark all unread messages in chat as read
                const unreadMessages = messages.filter((msg: any) =>
                    msg.key?.fromMe === false &&
                    msg.message &&
                    msg.status !== 3 // Not already read
                );

                const unreadKeys = unreadMessages
                    .map((msg: any) => msg.key)
                    .filter((key: any) => key);

                if (unreadKeys.length > 0) {
                    await this.vendor.readMessages(unreadKeys);
                    if (this.globalVendorArgs.debug) console.log(`Marked ${unreadKeys.length} unread messages as read for ${canonicalJid}`);

                    // Update status in store for all unread messages
                    unreadMessages.forEach((msg: any) => {
                        msg.status = 3; // 3 = read
                    });
                }
            }

            // Update chat unread count in store
            if (this.store?.chats) {
                const chat = this.store.chats.get?.(canonicalJid) ||
                    (this.store.chats[canonicalJid]);
                if (chat) {
                    chat.unreadCount = 0;
                }
            }

            return true;
        } catch (error: any) {
            console.error(`Error marking messages as read for ${jid}:`, error.message);
            return false;
        }
    }

    /**
     * Get unread message count for a chat
     * Status values: 0=pending, 1=sent, 2=delivered, 3=read, 4=error
     */
    getUnreadCount = (jid: string): number => {
        // Try multiple JID formats
        const phoneNumber = jid.split('@')[0];
        const possibleJids = [
            jid,
            `${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@lid`,
            `${phoneNumber}@c.us`
        ];

        for (const tryJid of possibleJids) {
            const storeMessages = this.store?.messages?.[tryJid]?.array;
            if (storeMessages && storeMessages.length > 0) {
                return storeMessages.filter((msg: any) =>
                    msg.key?.fromMe === false &&
                    msg.message &&
                    msg.status !== 3 // 3 = read
                ).length;
            }
        }

        return 0;
    }
}
