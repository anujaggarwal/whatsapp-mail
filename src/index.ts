import dotenv from 'dotenv';
dotenv.config();

import logger, { createChildLogger } from './utils/logger.js';
import { testConnection } from './config/database.js';
import './models/index.js';
import whatsappService from './services/whatsapp.service.js';
import { createServer } from './api/server.js';
import MessageHandler from './handlers/message.handler.js';
import HistoryHandler from './handlers/history.handler.js';
import ChatHandler from './handlers/chat.handler.js';
import ContactHandler from './handlers/contact.handler.js';
import GroupHandler from './handlers/group.handler.js';

const log = createChildLogger('main');

async function main(): Promise<void> {
  log.info('Starting WhatsApp Mail server...');

  // 1. Test database connection
  await testConnection();
  log.info('Database connection verified');

  // 2. Register event handlers BEFORE connecting (they persist across reconnects)
  whatsappService.onPersistent('messages.upsert', async (data) => {
    try {
      await MessageHandler.handleUpsert(data);
    } catch (err) {
      log.error({ err }, 'Error in messages.upsert handler');
    }
  });

  whatsappService.onPersistent('messaging-history.set', async (data) => {
    try {
      await HistoryHandler.handleHistorySet(data as unknown as Parameters<typeof HistoryHandler.handleHistorySet>[0]);
    } catch (err) {
      log.error({ err }, 'Error in messaging-history.set handler');
    }
  });

  whatsappService.onPersistent('chats.update', async (data) => {
    try {
      await ChatHandler.handleUpdate(data as Parameters<typeof ChatHandler.handleUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in chats.update handler');
    }
  });

  whatsappService.onPersistent('contacts.update', async (data) => {
    try {
      await ContactHandler.handleUpdate(data as Parameters<typeof ContactHandler.handleUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in contacts.update handler');
    }
  });

  whatsappService.onPersistent('groups.update', async (data) => {
    try {
      await GroupHandler.handleGroupUpdate(data as Parameters<typeof GroupHandler.handleGroupUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in groups.update handler');
    }
  });

  whatsappService.onPersistent('group-participants.update', async (data) => {
    try {
      await GroupHandler.handleParticipantsUpdate(data as unknown as Parameters<typeof GroupHandler.handleParticipantsUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in group-participants.update handler');
    }
  });

  // 3. Connect to WhatsApp (syncFullHistory: true for fresh session history sync)
  await whatsappService.connect({ syncFullHistory: true });
  log.info('WhatsApp socket created, waiting for connection...');

  // 4. Start Express API server
  const port = parseInt(process.env.PORT || '3001', 10);
  const app = createServer();
  app.listen(port, () => {
    log.info({ port }, `API server listening on http://localhost:${port}`);
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Received shutdown signal, cleaning up...');
    await whatsappService.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
