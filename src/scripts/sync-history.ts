import dotenv from 'dotenv';
dotenv.config();

import logger, { createChildLogger } from '../utils/logger.js';
import { testConnection } from '../config/database.js';
import '../models/index.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import HistoryHandler from '../handlers/history.handler.js';
import MessageHandler from '../handlers/message.handler.js';
import ChatHandler from '../handlers/chat.handler.js';
import ContactHandler from '../handlers/contact.handler.js';

const log = createChildLogger('sync-history');

/**
 * One-time bulk history sync script.
 * Connects with syncFullHistory=true, waits for all batches,
 * then exits when sync is complete.
 */
async function syncHistory(): Promise<void> {
  log.info('Starting historical message sync...');
  log.info('This will download ALL message history from WhatsApp.');
  log.info('Requires a fresh QR scan if first time with syncFullHistory.');

  // 1. Test database connection
  await testConnection();
  log.info('Database connection verified');

  // 2. Create a fresh WhatsApp service instance for sync
  const wa = WhatsAppService.getInstance();
  const sock = await wa.connect({ syncFullHistory: true });

  let totalMessages = 0;
  let totalChats = 0;
  let totalContacts = 0;
  let batchCount = 0;
  let lastBatchTime = Date.now();
  let isComplete = false;

  // 3. Register history sync handler
  sock.ev.on('messaging-history.set', async (data) => {
    batchCount++;
    lastBatchTime = Date.now();

    const msgCount = data.messages?.length || 0;
    const chatCount = data.chats?.length || 0;
    const contactCount = data.contacts?.length || 0;

    totalMessages += msgCount;
    totalChats += chatCount;
    totalContacts += contactCount;

    log.info({
      batch: batchCount,
      messages: msgCount,
      chats: chatCount,
      contacts: contactCount,
      totalMessages,
      totalChats,
      totalContacts,
    }, `History batch #${batchCount} received`);

    try {
      await HistoryHandler.handleHistorySet(data as unknown as Parameters<typeof HistoryHandler.handleHistorySet>[0]);
    } catch (err) {
      log.error({ err }, `Error processing history batch #${batchCount}`);
    }

    if (data.isLatest) {
      isComplete = true;
      log.info('WhatsApp indicated this is the latest batch (isLatest=true)');
    }
  });

  // Also capture real-time messages during sync
  sock.ev.on('messages.upsert', async (data) => {
    try {
      await MessageHandler.handleUpsert(data);
    } catch (err) {
      log.error({ err }, 'Error in messages.upsert during sync');
    }
  });

  sock.ev.on('chats.update', async (data) => {
    try {
      await ChatHandler.handleUpdate(data as Parameters<typeof ChatHandler.handleUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in chats.update during sync');
    }
  });

  sock.ev.on('contacts.update', async (data) => {
    try {
      await ContactHandler.handleUpdate(data as Parameters<typeof ContactHandler.handleUpdate>[0]);
    } catch (err) {
      log.error({ err }, 'Error in contacts.update during sync');
    }
  });

  // 4. Wait for sync to complete
  // WhatsApp sends batches for 2-5 minutes, then stops
  const IDLE_TIMEOUT_MS = 60_000; // 60 seconds with no new batches
  const MAX_WAIT_MS = 10 * 60_000; // 10 minutes max
  const startTime = Date.now();

  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const idleTime = Date.now() - lastBatchTime;

      // Check if done
      if (isComplete || idleTime > IDLE_TIMEOUT_MS || elapsed > MAX_WAIT_MS) {
        clearInterval(checkInterval);

        if (isComplete) {
          log.info('Sync completed (isLatest flag received)');
        } else if (idleTime > IDLE_TIMEOUT_MS) {
          log.info(`Sync appears complete (no new batches for ${Math.round(idleTime / 1000)}s)`);
        } else {
          log.warn('Sync timed out after max wait period');
        }

        resolve();
      } else if (batchCount > 0) {
        log.info({
          elapsed: `${Math.round(elapsed / 1000)}s`,
          totalMessages,
          totalChats,
          totalContacts,
          batchCount,
        }, 'Sync in progress...');
      }
    }, 10_000); // Check every 10 seconds
  });

  // 5. Print summary
  log.info('');
  log.info('='.repeat(50));
  log.info('SYNC COMPLETE');
  log.info('='.repeat(50));
  log.info({ totalMessages, totalChats, totalContacts, batchCount }, 'Final sync statistics');
  log.info('='.repeat(50));

  // 6. Disconnect and exit
  await wa.disconnect();
  process.exit(0);
}

syncHistory().catch((err) => {
  logger.error({ err }, 'Fatal error during history sync');
  process.exit(1);
});
