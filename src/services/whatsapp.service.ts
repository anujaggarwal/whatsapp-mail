import makeWASocket, {
  DisconnectReason,
  type WASocket,
  type BaileysEventMap,
  type UserFacingSocketConfig,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import { createBaileysConfig, createAuthState } from '../config/baileys.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('whatsapp-service');

const QR_IMAGE_PATH = './whatsapp-qr.png';

interface ConnectOptions {
  syncFullHistory?: boolean;
}

type EventHandler<T extends keyof BaileysEventMap> = {
  event: T;
  handler: (data: BaileysEventMap[T]) => void;
};

class WhatsAppService {
  private static instance: WhatsAppService | null = null;

  private sock: WASocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  // Store registered handlers so they survive reconnects
  private registeredHandlers: EventHandler<any>[] = [];

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Register an event handler that persists across reconnects.
   * Call this instead of sock.ev.on() directly.
   */
  onPersistent<T extends keyof BaileysEventMap>(
    event: T,
    handler: (data: BaileysEventMap[T]) => void
  ): void {
    this.registeredHandlers.push({ event, handler });
    // If already connected, register immediately
    if (this.sock) {
      this.sock.ev.on(event, handler);
    }
  }

  /**
   * Apply all registered handlers to the current socket.
   */
  private applyHandlers(): void {
    if (!this.sock) return;
    for (const { event, handler } of this.registeredHandlers) {
      this.sock.ev.on(event, handler);
    }
    log.info({ handlerCount: this.registeredHandlers.length }, 'Event handlers registered on socket');
  }

  /**
   * Connects to WhatsApp using Baileys v7.
   * Handles QR code generation (saves as PNG), credential persistence,
   * and automatic reconnection with exponential backoff.
   */
  async connect(options?: ConnectOptions): Promise<WASocket> {
    if (this.isConnecting) {
      log.warn('Connection attempt already in progress');
      if (this.sock) return this.sock;
      throw new Error('Connection in progress, socket not yet available');
    }

    this.isConnecting = true;

    try {
      const { state, saveCreds } = await createAuthState();
      const configOverrides: Record<string, unknown> = {};

      if (options?.syncFullHistory !== undefined) {
        configOverrides.syncFullHistory = options.syncFullHistory;
      }

      const config = await createBaileysConfig({
        auth: state,
        ...configOverrides,
      });

      log.info(
        { version: config.version, syncFullHistory: config.syncFullHistory },
        'Creating WhatsApp socket'
      );

      this.sock = makeWASocket(config as UserFacingSocketConfig);

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection state changes
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          log.info('QR code received, saving as image...');
          try {
            await QRCode.toFile(QR_IMAGE_PATH, qr, { width: 600 });
            log.info({ path: QR_IMAGE_PATH }, 'QR code saved as PNG');
          } catch (err) {
            log.error({ err }, 'Failed to save QR code as image');
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          log.warn(
            { statusCode, isLoggedOut },
            'Connection closed'
          );

          this.isConnecting = false;

          if (isLoggedOut) {
            log.error('Logged out from WhatsApp. Manual re-authentication required.');
            this.sock = null;
            return;
          }

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(
              1000 * Math.pow(2, this.reconnectAttempts),
              60000
            );
            log.info(
              {
                attempt: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts,
                delayMs: delay,
              },
              'Reconnecting with exponential backoff...'
            );
            setTimeout(() => {
              this.connect(options).catch((err) => {
                log.error({ err }, 'Reconnection failed');
              });
            }, delay);
          } else {
            log.error(
              { maxAttempts: this.maxReconnectAttempts },
              'Max reconnection attempts reached. Giving up.'
            );
            this.sock = null;
          }
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          log.info('Connected to WhatsApp successfully');
        }
      });

      // Apply all persistent handlers to the new socket
      this.applyHandlers();

      return this.sock;
    } catch (err) {
      this.isConnecting = false;
      throw err;
    }
  }

  /**
   * Returns the active WhatsApp socket.
   * Throws if not connected.
   */
  getSocket(): WASocket {
    if (!this.sock) {
      throw new Error(
        'WhatsApp socket not available. Call connect() first.'
      );
    }
    return this.sock;
  }

  /**
   * Disconnects the WhatsApp socket gracefully.
   */
  async disconnect(): Promise<void> {
    if (this.sock) {
      log.info('Disconnecting WhatsApp socket...');
      this.sock.end(undefined);
      this.sock = null;
      this.isConnecting = false;
      log.info('WhatsApp socket disconnected');
    }
  }

  /**
   * Proxy to register event handlers on the Baileys socket.
   * NOTE: These handlers do NOT survive reconnects. Use onPersistent() instead.
   */
  on<T extends keyof BaileysEventMap>(
    event: T,
    handler: (data: BaileysEventMap[T]) => void
  ): void {
    const socket = this.getSocket();
    socket.ev.on(event, handler);
  }
}

export { WhatsAppService };
export default WhatsAppService.getInstance();
