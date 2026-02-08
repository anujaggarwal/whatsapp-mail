import { Chat } from '../models/index.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('chat-handler');

interface ChatUpdate {
  id: string;
  archive?: boolean | null;
  pin?: number | null;
  mute?: number | null;
  name?: string | null;
  unreadCount?: number | null;
  [key: string]: unknown;
}

class ChatHandler {
  /**
   * Handles chats.update events from Baileys.
   * Updates chat metadata fields (archive, pin, mute, name, unreadCount).
   * Only updates fields that are present in the update object.
   */
  static async handleUpdate(updates: ChatUpdate[]): Promise<void> {
    log.info({ count: updates.length }, 'Processing chat updates');

    for (const update of updates) {
      try {
        if (!update.id) {
          log.warn('Skipping chat update with missing id');
          continue;
        }

        const chat = await Chat.findOne({ where: { chat_id: update.id } });
        if (!chat) {
          log.debug({ chatId: update.id }, 'Chat not found for update, skipping');
          continue;
        }

        const changes: Record<string, unknown> = {};

        if (update.archive !== undefined && update.archive !== null) {
          changes.is_archived = update.archive;
        }

        if (update.pin !== undefined && update.pin !== null) {
          // pin is a timestamp when pinned, 0 or undefined when unpinned
          changes.is_pinned = update.pin > 0;
        }

        if (update.mute !== undefined && update.mute !== null) {
          // mute is a timestamp when muted until, 0 or undefined when unmuted
          changes.is_muted = update.mute > 0;
        }

        if (update.name !== undefined) {
          changes.name = update.name;
        }

        if (update.unreadCount !== undefined && update.unreadCount !== null) {
          changes.unread_count = update.unreadCount;
        }

        if (Object.keys(changes).length > 0) {
          await chat.update(changes);
          log.info(
            { chatId: update.id, changes },
            'Chat updated'
          );
        }
      } catch (err) {
        log.error({ err, chatId: update.id }, 'Failed to process chat update');
      }
    }
  }
}

export { ChatHandler };
export default ChatHandler;
