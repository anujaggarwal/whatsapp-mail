import type { proto } from '@whiskeysockets/baileys';
import { Chat, Contact, sequelize } from '../models/index.js';
import { MessageHandler } from './message.handler.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('history-handler');

/**
 * Determines the chat type from a JID string.
 */
function chatTypeFromJid(jid: string): 'private' | 'group' | 'broadcast' {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  return 'private';
}

interface HistorySetEvent {
  messages: proto.IWebMessageInfo[];
  chats: { id: string; name?: string | null; [key: string]: unknown }[];
  contacts: { id: string; name?: string | null; notify?: string | null; [key: string]: unknown }[];
  isLatest: boolean;
}

const MESSAGE_BATCH_SIZE = 100;

class HistoryHandler {
  /**
   * Handles the messaging-history.set event from Baileys.
   * Processes chats, contacts, and messages in batches within a transaction.
   */
  static async handleHistorySet({
    messages,
    chats,
    contacts,
    isLatest,
  }: HistorySetEvent): Promise<void> {
    log.info(
      {
        messageCount: messages.length,
        chatCount: chats.length,
        contactCount: contacts.length,
        isLatest,
      },
      'Processing history sync batch'
    );

    const transaction = await sequelize.transaction();

    try {
      // Process chats
      let chatsProcessed = 0;
      for (const chatData of chats) {
        if (!chatData.id) continue;

        const chatType = chatTypeFromJid(chatData.id);
        const chatName = (chatData.name as string) || null;

        const [chat, created] = await Chat.findOrCreate({
          where: { chat_id: chatData.id },
          defaults: {
            chat_id: chatData.id,
            chat_type: chatType,
            name: chatName,
          },
          transaction,
        });

        // Update name if we now have one and the existing record doesn't
        if (!created && chatName && !chat.name) {
          await chat.update({ name: chatName }, { transaction });
        }

        chatsProcessed++;
      }

      // Process contacts
      let contactsProcessed = 0;
      for (const contactData of contacts) {
        if (!contactData.id) continue;

        const contactName =
          (contactData.name as string) ||
          (contactData.notify as string) ||
          null;

        await Contact.findOrCreate({
          where: { contact_id: contactData.id },
          defaults: {
            contact_id: contactData.id,
            name: contactName,
          },
          transaction,
        });
        contactsProcessed++;
      }

      await transaction.commit();

      // Process messages in batches (outside transaction to avoid long-held locks)
      let messagesProcessed = 0;
      for (let i = 0; i < messages.length; i += MESSAGE_BATCH_SIZE) {
        const batch = messages.slice(i, i + MESSAGE_BATCH_SIZE);
        await MessageHandler.handleUpsert({
          messages: batch,
          type: 'history',
        });
        messagesProcessed += batch.length;

        if (messagesProcessed % 500 === 0 || messagesProcessed === messages.length) {
          log.info(
            { messagesProcessed, total: messages.length },
            'History sync progress'
          );
        }
      }

      log.info(
        {
          chatsProcessed,
          contactsProcessed,
          messagesProcessed,
        },
        `History sync: ${messagesProcessed} messages, ${chatsProcessed} chats, ${contactsProcessed} contacts processed`
      );

      if (isLatest) {
        log.info('History sync complete (isLatest=true)');
      }
    } catch (err) {
      await transaction.rollback();
      log.error({ err }, 'Failed to process history sync batch');
      throw err;
    }
  }
}

export { HistoryHandler };
export default HistoryHandler;
