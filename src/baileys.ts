import { EventEmitter } from 'events';
import pino, { Logger as PinoLogger } from 'pino'
import NodeCache from 'node-cache'
import Logger from './server/services/loggerService'
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
import { readFileSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, isAbsolute } from 'path';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

import mime from 'mime-types';

import utils from './utils';
import { getErrorMessage } from './server/utils/errorUtils';



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
    private storeInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_DELAY_MS = 60_000; // 1 minute max
    private readonly MAX_RECONNECT_ATTEMPTS = 5; // Reduced: stop sooner to avoid ban risk
    private lastError: string | null = null;
    private sessionCorruptionDetected: boolean = false;
    private intentionalDisconnect: boolean = false; // Track intentional disconnects

    constructor(args = {}) {

        super()
        this.vendor = null;
        this.store = null;
        this.globalVendorArgs = { name: `bot`, usePairingCode: false, phoneNumber: null, gifPlayback: false, dir: './', ...args };
        const sessionDirName = `${this.globalVendorArgs.name}_sessions`;
        const configuredBaseDir = this.globalVendorArgs.dir || './';
        this.NAME_DIR_SESSION = isAbsolute(configuredBaseDir)
            ? join(configuredBaseDir, sessionDirName)
            : join(process.cwd(), configuredBaseDir, sessionDirName);

        // FIX: Cannot await in constructor — catch errors to prevent unhandled rejections
        this.initBailey().catch((err: any) => {
            Logger.error(`[Baileys] initBailey() failed during construction: ${err.message}`);
            this.lastError = err.message;
            this.emit('auth_failure', err);
        });

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
        try {
            const logger: PinoLogger = pino({ level: this.globalVendorArgs.debug ? 'debug' : 'fatal' });

            // Validate session directory before loading
            const sessionPath = this.NAME_DIR_SESSION;
            if (existsSync(sessionPath)) {
                const isValid = await this.validateSessionFiles(sessionPath);
                if (!isValid) {
                    if (!this.sessionCorruptionDetected) {
                        Logger.warn(`[Baileys] Invalid session files detected during init, clearing...`);
                    } else {
                        Logger.info(`[Baileys] Session still invalid, retrying cleanup...`);
                    }
                    this.sessionCorruptionDetected = true;
                    await this.clearSessionAndRestart();
                    return;
                }
            }

            const { state, saveCreds } = await useMultiFileAuthState(this.NAME_DIR_SESSION);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            if (this.globalVendorArgs.debug) {
                Logger.info(`[Baileys] Using WA v${version.join('.')}, isLatest: ${isLatest}`);
            }

            this.store = makeInMemoryStore({ logger });
            const storePath = `${this.NAME_DIR_SESSION}/baileys_store.json`;

            // Validate store file before loading
            if (existsSync(storePath)) {
                try {
                    this.store.readFromFile(storePath);
                    Logger.info(`[Baileys] Store loaded successfully from ${storePath}`);
                } catch (storeError: any) {
                    Logger.warn(`[Baileys] Store file corrupted, starting fresh: ${storeError.message}`);
                    // Store will start fresh if file is corrupted
                }
            }

            // Clear previous interval to prevent accumulation on reconnections
            if (this.storeInterval) {
                clearInterval(this.storeInterval);
            }
            // Save interval: 5 minutes (increased from 10s to reduce I/O on large files)
            this.storeInterval = setInterval(() => {
                try {
                    this.pruneStore(); // Prune before saving to keep file size small
                    this.store.writeToFile(storePath);
                    Logger.debug(`[Baileys] Store saved and pruned successfully to ${storePath}`);
                } catch (writeError: any) {
                    Logger.error(`[Baileys] Failed to write store: ${writeError.message}`);
                }
            }, 5 * 60_000);

            try {
                await this.setUpBaileySock({ version, logger, state, saveCreds });
            } catch (e: any) {
                // Check for MAC/corruption errors during socket setup
                if (this.detectSessionCorruption(e)) {
                    Logger.warn(`[Baileys] Corruption detected during setup, clearing session...`);
                    await this.clearSessionAndRestart();
                } else {
                    Logger.error(`[Baileys] Socket setup failed: ${e.message}`);
                    this.emit('auth_failure', e);
                }
            }
        } catch (initError: any) {
            Logger.error(`[Baileys] Initialization failed: ${initError.message}`);

            // Check if this is a corruption error
            if (this.detectSessionCorruption(initError)) {
                await this.clearSessionAndRestart();
            } else {
                this.emit('auth_failure', initError);
            }
        }
    }

    setUpBaileySock = async ({ version, logger, state, saveCreds }) => {
        try {
            // MEMORY LEAK FIX: Remove all event listeners from previous socket before creating new one
            if (this.sock?.ev) {
                try {
                    this.sock.ev.removeAllListeners();
                    Logger.info('[Baileys] Cleaned up previous socket event listeners');
                } catch (_e) {
                    // Ignore if old socket is already disposed
                }
            }

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
                syncFullHistory: false, // CRITICAL: false prevents massive data transfer on reconnect
                // Connection tuning for stability
                retryRequestDelayMs: 500, // Slightly slower retries to reduce server pressure
                maxMsgRetryCount: 3, // Fewer retries per message
                connectTimeoutMs: 60_000,
                keepAliveIntervalMs: 30_000, // 30s keep-alive (less aggressive)
            });

            this.store?.bind(this.sock.ev);

            if (this.globalVendorArgs.usePairingCode) {
                if (this.globalVendorArgs.phoneNumber) {
                    await this.sock.waitForConnectionUpdate((update) => !!update.qr);
                    const code = await this.sock.requestPairingCode(this.globalVendorArgs.phoneNumber);
                    if (this.plugin) {
                        this.emit('require_action', {
                            instructions: [
                                `Acepta la notificación del WhatsApp ${this.globalVendorArgs.phoneNumber} en tu celular 👌`,
                                `El token para la vinculación es: ${code}`,
                                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                            ],
                        });
                    } else {
                        this.emit('pairing_code', code);
                    }
                } else {
                    this.emit('auth_failure', 'phoneNumber is empty');
                }
            }

            // Enhanced event listeners with error handling
            this.sock.ev.on('connection.update', this.handleConnectionUpdate);

            this.sock.ev.on('creds.update', async (update) => {
                try {
                    await saveCreds();
                } catch (credsError: any) {
                    Logger.error(`[Baileys] Failed to save credentials: ${credsError.message}`);
                    // Detect corruption in credentials saving
                    if (this.detectSessionCorruption(credsError)) {
                        await this.clearSessionAndRestart();
                    }
                }
            });

            // Add error listener for socket-level errors
            this.sock.ev.on('error', (error: any) => {
                Logger.error(`[Baileys] Socket error: ${error.message}`);
                if (this.detectSessionCorruption(error)) {
                    // FIX: Properly await the async cleanup to prevent race conditions
                    this.clearSessionAndRestart().catch((cleanupErr: any) => {
                        Logger.error(`[Baileys] clearSessionAndRestart failed after socket error: ${cleanupErr.message}`);
                    });
                }
            });

        } catch (socketError: any) {
            Logger.error(`[Baileys] Socket creation failed: ${socketError.message}`);
            throw socketError;
        }
    }

    /**
     * Detect and handle session corruption including MAC errors
     */
    private detectSessionCorruption = (error: any): boolean => {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorStack = error?.stack?.toLowerCase() || '';

        // MAC error patterns
        const macErrorPatterns = [
            'bad mac',
            'mac verification failed',
            'invalid mac',
            'mac mismatch',
            'corrupt',
            'corrupted',
            'integrity check failed',
            'signature verification failed',
            'libsignal'
        ];

        // Session corruption patterns
        const corruptionPatterns = [
            'session file corrupted',
            'auth state corrupted',
            'invalid auth state',
            'malformed json',
            'json parse error',
            'unexpected end of json input',
            'failed to decrypt'
        ];

        const isMacError = macErrorPatterns.some(pattern => errorMessage.includes(pattern) || errorStack.includes(pattern));
        const isCorruptionError = corruptionPatterns.some(pattern => errorMessage.includes(pattern) || errorStack.includes(pattern));

        if (isMacError || isCorruptionError) {
            Logger.error(`[Baileys] Session corruption detected: ${error.message}`);
            this.lastError = error.message;
            this.sessionCorruptionDetected = true;
            return true;
        }

        return false;
    };

    handleConnectionUpdate = async (update: any): Promise<void> => {
        const { connection, lastDisconnect, qr } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const error = lastDisconnect?.error;

        if (connection === 'close') {
            this.vendor = undefined; // Clear vendor on disconnect

            // If this was an intentional disconnect, do NOT reconnect
            if (this.intentionalDisconnect) {
                Logger.info(`[Baileys] Intentional disconnect — not reconnecting`);
                this.intentionalDisconnect = false;
                this.emit('disconnected', { intentional: true });
                return;
            }

            this.emit('disconnected', { intentional: false });

            // Check for session corruption including MAC errors
            const isCorrupted = this.detectSessionCorruption(error);

            // Only clear session on explicit logout or confirmed corruption
            if (statusCode === DisconnectReason.loggedOut) {
                Logger.warn(`[Baileys] Logged out by WhatsApp, clearing session...`);
                this.reconnectAttempts = 0;
                await this.clearSessionAndRestart();
            } else if (isCorrupted) {
                Logger.warn(`[Baileys] Session corruption detected, clearing and restarting...`);
                this.reconnectAttempts = 0;
                await this.clearSessionAndRestart();
            } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                // CRITICAL FIX: Do NOT clear session on max attempts.
                // Just STOP reconnecting and notify the user. They can manually reconnect.
                // Clearing session forces a new QR scan which can trigger a WhatsApp ban.
                Logger.error(`[Baileys] Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Stopping to prevent ban risk. Use manual reconnect.`);
                this.lastError = `Max reconnection attempts reached (status: ${statusCode || 'unknown'})`;
                this.emit('max_reconnect_reached', {
                    attempts: this.reconnectAttempts,
                    lastStatusCode: statusCode,
                    lastError: error?.message || 'unknown'
                });
                // Do NOT reset reconnectAttempts — keep them high so we don't auto-reconnect
            } else {
                // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 60s max
                const baseDelay = 2000; // Start at 2s (was 1s)
                const delay = Math.min(
                    baseDelay * Math.pow(2, this.reconnectAttempts),
                    this.MAX_RECONNECT_DELAY_MS
                );
                this.reconnectAttempts++;
                Logger.info(`[Baileys] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
                // FIX: Handle errors from delayed reconnect to prevent silent failures
                this.reconnectTimeout = setTimeout(() => {
                    this.initBailey().catch((err: any) => {
                        Logger.error(`[Baileys] Reconnect initBailey() failed: ${err.message}`);
                        this.emit('auth_failure', err);
                    });
                }, delay);
            }
        }

        if (connection === 'open') {
            this.reconnectAttempts = 0; // Reset on successful connection
            this.sessionCorruptionDetected = false;
            this.lastError = null;
            this.vendor = this.sock;
            Logger.info(`[Baileys] Bot connected! (Session: ${this.globalVendorArgs.name})`);
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

    /**
     * Prune the in-memory store to prevent huge session files.
     * Keeps only the latest N messages per chat.
     */
    private pruneStore = (): void => {
        if (!this.store?.messages) return;

        const MAX_MESSAGES_PER_CHAT = 500;
        let prunedChats = 0;
        let totalRemoved = 0;

        try {
            this.store.messages.forEach((chatMessages: any, jid: string) => {
                if (chatMessages?.array?.length > MAX_MESSAGES_PER_CHAT) {
                    const originalCount = chatMessages.array.length;
                    // Splice to keep only the last MAX_MESSAGES_PER_CHAT
                    chatMessages.array = chatMessages.array.slice(-MAX_MESSAGES_PER_CHAT);
                    totalRemoved += (originalCount - chatMessages.array.length);
                    prunedChats++;
                }
            });

            if (prunedChats > 0) {
                Logger.info(`[Baileys] Store pruned: cleaned ${prunedChats} chats, removed ${totalRemoved} old messages`);
            }
        } catch (error: any) {
            Logger.error(`[Baileys] Failed to prune store: ${error.message}`);
        }
    }

    /**
     * Validate session file integrity before loading
     */
    private validateSessionFiles = async (sessionPath: string): Promise<boolean> => {
        try {
            if (!existsSync(sessionPath)) return true; // No files to validate

            const files = readdirSync(sessionPath);
            let totalSize = 0;
            let hasCredsFile = false;
            let credsRegistered = false;
            let keyFileCount = 0;

            for (const file of files) {
                const filePath = join(sessionPath, file);
                try {
                    const stats = statSync(filePath);
                    totalSize += stats.size;

                    if (file === 'creds.json') {
                        hasCredsFile = true;
                    }
                    if (file.startsWith('session-') && file.endsWith('.json')) {
                        keyFileCount++;
                    }

                    // Check for empty files or unusually large files
                    if (stats.size === 0) {
                        // Empty store file can happen during first boot; don't treat as corruption.
                        if (file === 'baileys_store.json') {
                            continue;
                        }
                        Logger.warn(`[Baileys] Empty session file detected: ${file}`);
                        return false;
                    }

                    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
                        Logger.warn(`[Baileys] Oversized session file detected: ${file} (${stats.size} bytes)`);
                        return false;
                    }

                    // Try to read and parse JSON files
                    if (file.endsWith('.json')) {
                        const content = readFileSync(filePath, 'utf-8');
                        const parsed = JSON.parse(content);
                        if (file === 'creds.json') {
                            credsRegistered = !!parsed?.registered;
                        }
                    }
                } catch (parseError: any) {
                    Logger.error(`[Baileys] Invalid session file ${file}: ${parseError.message}`);
                    return false;
                }
            }

            // Fresh/unregistered session is expected to be small and should not be considered corruption.
            if (hasCredsFile && !credsRegistered) {
                Logger.info(`[Baileys] Session is unregistered (awaiting QR scan). Keeping current auth state.`);
                return true;
            }

            // Registered session should have credential + signal key files.
            if (hasCredsFile && credsRegistered && keyFileCount === 0) {
                Logger.warn(`[Baileys] Registered session missing signal key files, treating as corrupted.`);
                return false;
            }

            // Keep heuristic but only for registered sessions.
            if (hasCredsFile && credsRegistered && totalSize < 100 && files.length > 0) {
                Logger.warn(`[Baileys] Registered session directory too small (${totalSize} bytes), likely corrupted`);
                return false;
            }

            return true;
        } catch (error: unknown) {
            Logger.error(`[Baileys] Session validation error: ${getErrorMessage(error)}`);
            return false;
        }
    };

    clearSessionAndRestart = async (): Promise<void> => {
        const PATH_BASE = this.NAME_DIR_SESSION;

        Logger.info(`[Baileys] Starting session cleanup process...`);

        // 0. Cancel any pending reconnect timeout to prevent race conditions
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Clean up store interval during session reset
        if (this.storeInterval) {
            clearInterval(this.storeInterval);
            this.storeInterval = null;
        }

        // 1. Close socket and remove listeners to release locks
        try {
            if (this.sock?.ev) {
                try {
                    this.sock.ev.removeAllListeners();
                } catch (_e) { /* ignore */ }
            }
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = undefined;
                this.vendor = undefined;
            }
        } catch (e: any) {
            Logger.error(`[Baileys] Error closing socket: ${e.message}`);
        }

        // 2. Wait for locks to release
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Enhanced session cleanup with validation
        const maxRetries = 5;
        let sessionCleared = false;

        for (let i = 0; i < maxRetries; i++) {
            try {
                if (existsSync(PATH_BASE)) {
                    // First validate before clearing
                    const isValid = await this.validateSessionFiles(PATH_BASE);
                    if (!isValid || this.sessionCorruptionDetected) {
                        Logger.warn(`[Baileys] Clearing corrupted session (attempt ${i + 1})`);
                        rmSync(PATH_BASE, { recursive: true, force: true });
                        sessionCleared = true;
                    } else {
                        Logger.info(`[Baileys] Session files are valid, not clearing`);
                        sessionCleared = true;
                    }
                } else {
                    Logger.info(`[Baileys] No session directory found, starting fresh`);
                    sessionCleared = true;
                }

                if (sessionCleared) {
                    Logger.info(`[Baileys] Session cleared successfully on attempt ${i + 1}`);
                    this.sessionCorruptionDetected = false; // Reset corruption flag
                    this.lastError = null;
                    break;
                }
            } catch (error: unknown) {
                Logger.error(`[Baileys] Error clearing session (attempt ${i + 1}): ${getErrorMessage(error)}`);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Progressive wait
                }
            }
        }

        if (!sessionCleared) {
            Logger.error(`[Baileys] Failed to clear session after ${maxRetries} attempts`);
            this.emit('auth_failure', new Error('Failed to clear corrupted session'));
            return;
        }

        // 4. Restart with fresh session
        try {
            Logger.info(`[Baileys] Restarting with fresh session...`);
            await this.initBailey();
        } catch (initError: any) {
            Logger.error(`[Baileys] Failed to initialize after session cleanup: ${initError.message}`);
            this.emit('auth_failure', initError);
        }
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
        try {
            // Remove all previous listeners to prevent duplicates on reconnect
            if (this.vendor && this.vendor.ev && this.vendor !== _sock) {
                try {
                    this.vendor.ev.removeAllListeners();
                } catch (_e) {
                    // Ignore if old vendor is already disposed
                }
            }

            this.vendor = _sock;
            const listEvents = this.busEvents();

            for (const { event, func } of listEvents) {
                this.vendor.ev.on(event, func);
            }

            Logger.info('[Baileys] Event listeners initialized successfully');
        } catch (eventError: any) {
            Logger.error(`[Baileys] Failed to initialize event listeners: ${eventError.message}`);
            throw eventError;
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
     * Check if the bot is currently connected
     */
    isReady = (): boolean => {
        // Debug connection state
        const ready = !!this.vendor;
        // const connectionState = this.sock?.state?.connection?.state; // This might be wrong
        // Logger.info(`[Baileys Debug] isReady check: vendor=${!!this.vendor}, sock=${!!this.sock}`);
        return ready;
    }

    /**
     * Get connection status and health information
     */
    getConnectionHealth = () => {
        return {
            isReady: this.isReady(),
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError,
            sessionCorruptionDetected: this.sessionCorruptionDetected,
            connectionState: 'unknown', // Removed unreliable state check
            hasVendor: !!this.vendor,
            hasStore: !!this.store
        };
    }

    /**
     * Force session cleanup and restart (use only for confirmed corruption)
     */
    forceSessionReset = async (): Promise<void> => {
        Logger.warn('[Baileys] Force session reset requested');
        this.sessionCorruptionDetected = true;
        await this.clearSessionAndRestart();
    }

    /**
     * Gracefully disconnect without clearing session.
     * The session files are preserved so reconnecting doesn't require a new QR scan.
     */
    gracefulDisconnect = async (): Promise<void> => {
        Logger.info('[Baileys] Graceful disconnect requested');
        this.intentionalDisconnect = true;
        this.reconnectAttempts = 0;

        // Cancel any pending reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        try {
            // Remove event listeners before closing to prevent duplicate handlers
            if (this.sock?.ev) {
                try {
                    this.sock.ev.removeAllListeners();
                } catch (_e) { /* ignore */ }
            }
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = undefined;
                this.vendor = undefined;
            }
        } catch (e: any) {
            Logger.error(`[Baileys] Error during graceful disconnect: ${e.message}`);
        }

        // Clean up store interval
        if (this.storeInterval) {
            clearInterval(this.storeInterval);
            this.storeInterval = null;
        }

        Logger.info('[Baileys] Gracefully disconnected. Session preserved.');
    }

    /**
     * Manually reconnect after a disconnect or after max reconnect attempts were reached.
     */
    reconnect = async (): Promise<void> => {
        Logger.info('[Baileys] Manual reconnect requested');
        this.intentionalDisconnect = false;
        this.reconnectAttempts = 0;
        this.lastError = null;
        await this.initBailey();
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number: string, message: string): Promise<any> => {
        if (!this.isReady()) {
            throw new Error('Connection is not ready');
        }
        const numberClean = utils.formatPhone(number)
        return this.sock.sendMessage(numberClean, { text: message })
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

    fetchMessageHistory = async (jid: string, count: number = 50, beforeMessageId?: string): Promise<any[]> => {
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
                const storeMessages = this.store.messages instanceof Map ? this.store.messages.get(tryJid) : this.store.messages[tryJid];
                if (storeMessages?.array?.length > 0) {
                    console.log(`Found ${storeMessages.array.length} messages for ${tryJid}`);

                    let messages = storeMessages.array;

                    // If beforeMessageId is provided, find the index and return messages before it
                    if (beforeMessageId) {
                        const messageIndex = messages.findIndex((msg: any) => msg.key?.id === beforeMessageId);
                        if (messageIndex > 0) {
                            // Return messages before the specified message
                            const startIndex = Math.max(0, messageIndex - count);
                            return messages.slice(startIndex, messageIndex);
                        }
                        // If message not found, return last count messages
                        return messages.slice(-count);
                    }

                    return messages.slice(-count);
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
                // Generate a random ID for the message key to avoid "Incomplete key" error
                const randomId = Math.random().toString(36).substring(2, 12).toUpperCase();
                await this.vendor.chatModify(
                    { lastMessages: [{ key: { remoteJid: canonicalJid, fromMe: true, id: randomId }, messageTimestamp: Math.floor(Date.now() / 1000) }], clear: false },
                    canonicalJid
                );
                if (this.globalVendorArgs.debug) console.log(`ChatModify sent for ${canonicalJid} with ID ${randomId}`);
            } catch (chatModifyError: any) {
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

        } catch (error: unknown) {
            console.error(`Error in fetchMessageHistory for ${jid}:`, getErrorMessage(error));
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
                const chat = this.store.chats.get?.(canonicalJid);
                if (chat) {
                    chat.unreadCount = 0;
                }
            }

            return true;
        } catch (error: unknown) {
            console.error(`Error marking messages as read for ${jid}:`, getErrorMessage(error));
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
            const storeMessages = this.store?.messages?.get?.(tryJid)?.array;
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
