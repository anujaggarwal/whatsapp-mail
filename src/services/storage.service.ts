import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import s3Client, { S3_BUCKET } from '../config/s3.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('StorageService');

const MIMETYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'text/plain': 'txt',
};

const MEDIA_MESSAGE_KEYS = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'ptvMessage',
] as const;

type MediaMessageKey = typeof MEDIA_MESSAGE_KEYS[number];

const MEDIA_KEY_TO_TYPE: Record<MediaMessageKey, string> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  ptvMessage: 'video',
};

interface UploadResult {
  storageKey: string;
  storageUrl: string;
  sizeBytes: number;
}

interface DownloadAndUploadResult extends UploadResult {
  mimetype: string;
  filename: string | null;
}

class StorageService {
  static getAllowedMediaTypes(): string[] {
    const types = process.env.SAVE_MEDIA_TYPES || 'image,video,document';
    return types.split(',').map((t) => t.trim().toLowerCase());
  }

  static getMaxMediaSize(): number {
    const mb = parseInt(process.env.MAX_MEDIA_SIZE_MB || '50', 10);
    return mb * 1024 * 1024;
  }

  static isMediaAllowed(messageType: string): boolean {
    const allowed = StorageService.getAllowedMediaTypes();
    return allowed.includes(messageType.toLowerCase());
  }

  static generateS3Key(chatId: string, messageId: string, ext: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const sanitizedChatId = chatId.replace(/[@.]/g, '_');
    return `${year}/${month}/${sanitizedChatId}/${messageId}.${ext}`;
  }

  static getExtensionFromMimetype(mimetype: string): string {
    return MIMETYPE_EXTENSIONS[mimetype] || 'bin';
  }

  static async uploadMedia(
    buffer: Buffer,
    mimetype: string,
    chatId: string,
    messageId: string,
  ): Promise<UploadResult> {
    const maxSize = StorageService.getMaxMediaSize();
    if (buffer.length > maxSize) {
      throw new Error(
        `Media size ${buffer.length} bytes exceeds max allowed ${maxSize} bytes`,
      );
    }

    const ext = StorageService.getExtensionFromMimetype(mimetype);
    const storageKey = StorageService.generateS3Key(chatId, messageId, ext);
    const region = process.env.AWS_REGION || 'us-east-1';

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);

    const storageUrl = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${storageKey}`;

    logger.info({ storageKey, sizeBytes: buffer.length }, 'Media uploaded to S3');

    return {
      storageKey,
      storageUrl,
      sizeBytes: buffer.length,
    };
  }

  static async getPresignedUrl(storageKey: string, expiresIn = 604800): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  static async downloadAndUploadMedia(
    msg: WAMessage,
    sock: WASocket,
  ): Promise<DownloadAndUploadResult | null> {
    try {
      if (!msg.message) {
        logger.warn({ messageId: msg.key.id }, 'No message content found');
        return null;
      }

      // Determine media type from message keys
      let mediaKey: MediaMessageKey | null = null;
      for (const key of MEDIA_MESSAGE_KEYS) {
        if (msg.message[key]) {
          mediaKey = key;
          break;
        }
      }

      if (!mediaKey) {
        logger.debug({ messageId: msg.key.id }, 'No media content in message');
        return null;
      }

      const mediaType = MEDIA_KEY_TO_TYPE[mediaKey];

      if (!StorageService.isMediaAllowed(mediaType)) {
        logger.debug(
          { messageId: msg.key.id, mediaType },
          'Media type not in allowed list, skipping',
        );
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mediaMessage = msg.message[mediaKey] as Record<string, any>;
      const mimetype: string = mediaMessage.mimetype || 'application/octet-stream';
      const filename: string | null = mediaMessage.fileName || null;

      // Check file size if available before downloading
      const fileLength = mediaMessage.fileLength
        ? typeof mediaMessage.fileLength === 'object'
          ? Number(mediaMessage.fileLength)
          : Number(mediaMessage.fileLength)
        : null;

      if (fileLength !== null && fileLength > StorageService.getMaxMediaSize()) {
        logger.warn(
          { messageId: msg.key.id, fileLength, maxSize: StorageService.getMaxMediaSize() },
          'Media file too large, skipping download',
        );
        return null;
      }

      // Download media buffer
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger: logger as unknown as Parameters<typeof downloadMediaMessage>[3] extends { logger: infer L } ? L : never,
          reuploadRequest: sock.updateMediaMessage,
        },
      );

      if (!Buffer.isBuffer(buffer)) {
        logger.error({ messageId: msg.key.id }, 'Downloaded media is not a Buffer');
        return null;
      }

      const chatId = msg.key.remoteJid || 'unknown';
      const messageId = msg.key.id || `msg_${Date.now()}`;

      const uploadResult = await StorageService.uploadMedia(
        buffer,
        mimetype,
        chatId,
        messageId,
      );

      logger.info(
        { messageId: msg.key.id, mediaType, storageKey: uploadResult.storageKey },
        'Media downloaded and uploaded successfully',
      );

      return {
        ...uploadResult,
        mimetype,
        filename,
      };
    } catch (error) {
      logger.error(
        { messageId: msg.key?.id, error },
        'Failed to download and upload media',
      );
      return null;
    }
  }
}

export default StorageService;
