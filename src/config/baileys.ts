import {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type SocketConfig,
} from '@whiskeysockets/baileys';
import pino from 'pino';

const DEFAULT_SESSION_DIR = './auth_info';

/**
 * Creates Baileys socket configuration options.
 * Uses environment variables for session directory.
 */
export async function createBaileysConfig(
  overrides?: Partial<SocketConfig>
): Promise<Partial<SocketConfig>> {
  const { version } = await fetchLatestBaileysVersion();

  return {
    version,
    logger: pino({ level: 'silent' }) as unknown as SocketConfig['logger'],
    printQRInTerminal: false,
    syncFullHistory: false,
    ...overrides,
  };
}

/**
 * Creates the multi-file auth state for Baileys session persistence.
 * Session files are stored in the directory specified by WHATSAPP_SESSION_DIR env var.
 */
export async function createAuthState() {
  const sessionDir = process.env.WHATSAPP_SESSION_DIR || DEFAULT_SESSION_DIR;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  return { state, saveCreds };
}
