import type { proto } from '@whiskeysockets/baileys';
import { Chat, Message, Contact } from '../models/index.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('message-handler');

/**
 * Maps Baileys message content keys to our message_type values.
 */
function resolveMessageType(messageContent: proto.IMessage | null | undefined): string {
  if (!messageContent) return 'unknown';

  const keys = Object.keys(messageContent);

  for (const key of keys) {
    switch (key) {
      case 'conversation':
      case 'extendedTextMessage':
        return 'chat';
      case 'imageMessage':
        return 'image';
      case 'videoMessage':
        return 'video';
      case 'audioMessage':
        return 'audio';
      case 'documentMessage':
      case 'documentWithCaptionMessage':
        return 'document';
      case 'stickerMessage':
        return 'sticker';
      case 'locationMessage':
      case 'liveLocationMessage':
        return 'location';
      case 'contactMessage':
      case 'contactsArrayMessage':
        return 'contact';
      case 'pollCreationMessage':
      case 'pollUpdateMessage':
        return 'poll';
      case 'reactionMessage':
        return 'reaction';
      case 'protocolMessage':
      case 'senderKeyDistributionMessage':
        return 'protocol';
      default:
        // Continue checking other keys
        break;
    }
  }

  return 'unknown';
}

/**
 * Extracts the text body from a Baileys message.
 */
function extractBody(messageContent: proto.IMessage | null | undefined): string | null {
  if (!messageContent) return null;

  return (
    messageContent.conversation ||
    messageContent.extendedTextMessage?.text ||
    messageContent.imageMessage?.caption ||
    messageContent.videoMessage?.caption ||
    messageContent.documentMessage?.caption ||
    messageContent.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    messageContent.pollCreationMessage?.name ||
    messageContent.reactionMessage?.text ||
    messageContent.contactMessage?.displayName ||
    messageContent.locationMessage?.name ||
    messageContent.liveLocationMessage?.caption ||
    null
  );
}

/**
 * Determines the chat type from a JID string.
 */
function chatTypeFromJid(jid: string): 'private' | 'group' | 'broadcast' {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  return 'private';
}

/**
 * Extracts a numeric timestamp from a Baileys messageTimestamp,
 * which can be a number, a Long object, or undefined.
 */
function extractTimestamp(ts: number | { low: number; high: number } | null | undefined): Date {
  if (ts === null || ts === undefined) return new Date();

  const numeric = typeof ts === 'object' && 'low' in ts
    ? Number(ts.low)
    : Number(ts);

  return new Date(numeric * 1000);
}

/**
 * Determines whether a message has downloadable media.
 */
function hasMedia(messageType: string): boolean {
  return ['image', 'video', 'audio', 'document', 'sticker'].includes(messageType);
}

interface UpsertEvent {
  messages: proto.IWebMessageInfo[];
  type: string;
}

class MessageHandler {
  /**
   * Handles messages.upsert events from Baileys.
   * Processes each message: resolves the chat, contact, and saves the message to the database.
   */
  static async handleUpsert({ messages, type }: UpsertEvent): Promise<void> {
    log.info({ count: messages.length, type }, 'Processing message upsert');

    for (const msg of messages) {
      try {
        const key = msg.key;
        if (!key?.remoteJid || !key.id) {
          log.warn({ key }, 'Skipping message with missing key fields');
          continue;
        }

        const chatJid = key.remoteJid;
        const messageId = key.id;
        const senderId = key.participant || key.remoteJid || '';
        const isFromMe = key.fromMe ?? false;
        const pushName = msg.pushName || null;

        const messageContent = msg.message;
        const messageType = resolveMessageType(messageContent);
        const body = extractBody(messageContent);
        const timestamp = extractTimestamp(msg.messageTimestamp);

        // Skip protocol messages like sender key distribution (noisy)
        if (messageType === 'protocol') {
          log.debug({ messageId, messageType }, 'Skipping protocol message');
          continue;
        }

        // Find or create the Chat record
        const chatType = chatTypeFromJid(chatJid);
        const [chat] = await Chat.findOrCreate({
          where: { chat_id: chatJid },
          defaults: {
            chat_id: chatJid,
            chat_type: chatType,
          },
        });

        // Find or create the Contact record for the sender
        if (senderId) {
          await Contact.findOrCreate({
            where: { contact_id: senderId },
            defaults: {
              contact_id: senderId,
              name: pushName,
            },
          });
        }

        // Extract context info (quoted messages, mentions)
        const contextInfo = messageContent?.extendedTextMessage?.contextInfo
          || messageContent?.imageMessage?.contextInfo
          || messageContent?.videoMessage?.contextInfo
          || messageContent?.audioMessage?.contextInfo
          || messageContent?.documentMessage?.contextInfo
          || null;

        const quotedStanzaId = contextInfo?.stanzaId || null;
        const mentions = contextInfo?.mentionedJid || null;

        // Resolve quoted message ID to our internal ID
        let quotedMessageDbId: number | null = null;
        if (quotedStanzaId) {
          const quotedMsg = await Message.findOne({
            where: { message_id: quotedStanzaId },
            attributes: ['id'],
          });
          if (quotedMsg) {
            quotedMessageDbId = quotedMsg.id;
          }
        }

        // Check if forwarded
        const isForwarded = !!(
          contextInfo?.isForwarded ||
          messageContent?.extendedTextMessage?.contextInfo?.isForwarded
        );

        // Determine media presence
        const msgHasMedia = hasMedia(messageType);

        // Extract media details if present
        const mediaMsg =
          messageContent?.imageMessage ||
          messageContent?.videoMessage ||
          messageContent?.audioMessage ||
          messageContent?.documentMessage ||
          messageContent?.stickerMessage ||
          null;

        const mediaMimetype = mediaMsg
          ? (mediaMsg as { mimetype?: string }).mimetype || null
          : null;

        const mediaFilename = messageContent?.documentMessage?.fileName || null;

        // Extract location data
        const locationData =
          messageType === 'location' && messageContent?.locationMessage
            ? {
                latitude: messageContent.locationMessage.degreesLatitude,
                longitude: messageContent.locationMessage.degreesLongitude,
                name: messageContent.locationMessage.name,
                address: messageContent.locationMessage.address,
              }
            : messageType === 'location' && messageContent?.liveLocationMessage
            ? {
                latitude: messageContent.liveLocationMessage.degreesLatitude,
                longitude: messageContent.liveLocationMessage.degreesLongitude,
                caption: messageContent.liveLocationMessage.caption,
              }
            : null;

        // Extract poll data
        const pollData =
          messageType === 'poll' && messageContent?.pollCreationMessage
            ? {
                name: messageContent.pollCreationMessage.name,
                options: messageContent.pollCreationMessage.options,
                selectableOptionsCount:
                  messageContent.pollCreationMessage.selectableOptionsCount,
              }
            : null;

        // Extract contact data
        const contactData =
          messageType === 'contact' && messageContent?.contactMessage
            ? {
                displayName: messageContent.contactMessage.displayName,
                vcard: messageContent.contactMessage.vcard,
              }
            : messageType === 'contact' && messageContent?.contactsArrayMessage
            ? {
                contacts: messageContent.contactsArrayMessage.contacts,
              }
            : null;

        // Save message (ignore duplicates)
        const [savedMsg, created] = await Message.findOrCreate({
          where: { message_id: messageId },
          defaults: {
            message_id: messageId,
            chat_id: chat.id,
            sender_id: senderId,
            sender_name: pushName,
            is_from_me: isFromMe,
            body,
            message_type: messageType,
            has_media: msgHasMedia,
            media_mimetype: mediaMimetype,
            media_filename: mediaFilename,
            media_caption: msgHasMedia ? body : null,
            timestamp,
            is_forwarded: isForwarded,
            quoted_message_id: quotedMessageDbId,
            mentions: mentions as string[] | null,
            poll_data: pollData as Record<string, unknown> | null,
            location_data: locationData as Record<string, unknown> | null,
            contact_data: contactData as Record<string, unknown> | null,
            raw_data: msg as unknown as Record<string, unknown>,
          },
        });

        if (created) {
          log.info(
            {
              messageId,
              chatJid,
              messageType,
              isFromMe,
              dbId: savedMsg.id,
            },
            'Message saved'
          );

          // Update chat last_message_at, preview, and name (from pushName)
          const chatUpdate: Record<string, unknown> = {
            last_message_at: timestamp,
            last_message_preview: body ? body.substring(0, 200) : `[${messageType}]`,
          };

          // Set chat name from pushName for private chats if not already set
          if (!chat.name && pushName && !isFromMe && chatType === 'private') {
            chatUpdate.name = pushName;
          }

          await chat.update(chatUpdate);
        } else {
          log.debug({ messageId }, 'Message already exists, skipped');
        }
      } catch (err) {
        log.error(
          { err, messageId: msg.key?.id, chatJid: msg.key?.remoteJid },
          'Failed to process message'
        );
      }
    }
  }
}

export { MessageHandler };
export default MessageHandler;
