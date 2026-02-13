# WhatsApp Message Data Structure

## Sample Export from Real Chat

This document shows the actual data structure of exported WhatsApp messages from our test with Vikas Agarwal contact.

## Export File Structure

```json
{
  "exportDate": "2026-02-06T05:33:38.655Z",
  "targetContact": {
    "name": "Vikas Agarwal",
    "jid": "919971115581@s.whatsapp.net"
  },
  "totalMessages": 677,
  "incomingMessages": 302,
  "outgoingMessages": 375,
  "messages": [...]
}
```

## Individual Message Structure

### Text Message (Incoming)

```json
{
  "timestamp": {
    "low": 1770354226,
    "high": 0,
    "unsigned": true
  },
  "date": "2026-02-06T05:03:46.000Z",
  "fromMe": false,
  "pushName": null,
  "text": "can we check no. of files uploaded by free users and not translated due to limit",
  "messageType": "conversation",
  "hasMedia": false,
  "chatId": "919971115581@s.whatsapp.net"
}
```

### Text Message (Outgoing)

```json
{
  "timestamp": {
    "low": 1770354347,
    "high": 0,
    "unsigned": true
  },
  "date": "2026-02-06T05:05:47.000Z",
  "fromMe": true,
  "pushName": null,
  "text": "New paying customer tpsharsha@gmail.com",
  "messageType": "conversation",
  "hasMedia": false,
  "chatId": "919971115581@s.whatsapp.net"
}
```

### Media Message

```json
{
  "timestamp": {
    "low": 1770348485,
    "high": 0,
    "unsigned": true
  },
  "date": "2026-02-06T03:28:05.000Z",
  "fromMe": false,
  "pushName": null,
  "text": null,
  "messageType": "imageMessage",
  "hasMedia": true,
  "chatId": "919971115581@s.whatsapp.net"
}
```

### Extended Text Message (with formatting/links)

```json
{
  "timestamp": {
    "low": 1770344192,
    "high": 0,
    "unsigned": true
  },
  "date": "2026-02-06T02:16:32.000Z",
  "fromMe": true,
  "pushName": null,
  "text": "https://chatgpt.com/share/6984905f-a084-800f-873f-37b69d121a4b",
  "messageType": "extendedTextMessage",
  "hasMedia": false,
  "chatId": "919971115581@s.whatsapp.net"
}
```

## Raw Baileys Message Structure

Before transformation, Baileys provides messages in this format:

```typescript
{
  key: {
    remoteJid: '919971115581@s.whatsapp.net',
    fromMe: false,
    id: '3EB0XXXX',
    participant: undefined  // For group messages, sender's JID
  },
  messageTimestamp: 1770354226,  // Unix timestamp (seconds)
  pushName: 'Vikas Agarwal',     // May be null
  message: {
    conversation: 'Text here'    // Simple text
    // OR
    extendedTextMessage: {
      text: 'Text with links/formatting',
      matchedText: 'https://...',
      canonicalUrl: 'https://...',
      description: 'Link preview text',
      title: 'Link preview title'
    }
    // OR
    imageMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'image/jpeg',
      fileSha256: Buffer,
      fileLength: 12345,
      height: 1080,
      width: 1920,
      mediaKey: Buffer,
      fileEncSha256: Buffer,
      directPath: '/v/...',
      mediaKeyTimestamp: 1770354226,
      jpegThumbnail: Buffer,
      caption: 'Photo caption'
    }
    // OR
    videoMessage: { ... }
    // OR
    documentMessage: {
      url: 'https://mmg.whatsapp.net/...',
      mimetype: 'application/pdf',
      title: 'document.pdf',
      fileSha256: Buffer,
      fileLength: 54321,
      pageCount: 10,
      mediaKey: Buffer,
      fileName: 'document.pdf',
      fileEncSha256: Buffer,
      directPath: '/v/...',
      mediaKeyTimestamp: 1770354226
    }
    // OR
    audioMessage: { ... }
    // OR
    stickerMessage: { ... }
    // OR
    contactMessage: { ... }
    // OR
    locationMessage: { ... }
  }
}
```

## JID Formats

### Individual Chats
- Format: `{country_code}{phone_number}@s.whatsapp.net`
- Example: `919971115581@s.whatsapp.net`

### Group Chats
- Format: `{group_id}@g.us`
- Example: `120363024567890123@g.us`

### Status Broadcasts
- Format: `status@broadcast`

### Communities (WhatsApp Communities)
- Format: `{community_id}@newsletter`

## Message Types

Common message types found in production:

1. `conversation` - Simple text
2. `extendedTextMessage` - Text with links/formatting
3. `imageMessage` - Photos
4. `videoMessage` - Videos
5. `documentMessage` - PDFs, DOCs, etc.
6. `audioMessage` - Voice notes, audio files
7. `stickerMessage` - Stickers
8. `contactMessage` - Shared contacts
9. `locationMessage` - Location pins
10. `reactionMessage` - Emoji reactions
11. `pollCreationMessage` - Polls
12. `pollUpdateMessage` - Poll votes
13. `protocolMessage` - System messages (delete, revoke)

## Database Schema Recommendations

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    chat_id VARCHAR(100) NOT NULL,
    from_me BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    push_name VARCHAR(255),

    -- Message content
    body TEXT,
    message_type VARCHAR(50) NOT NULL,

    -- Media
    has_media BOOLEAN DEFAULT FALSE,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_file_name VARCHAR(255),
    media_caption TEXT,

    -- Metadata
    raw_message JSONB,  -- Store complete raw message
    created_at TIMESTAMPTZ DEFAULT NOW(),

    INDEX idx_chat_timestamp (chat_id, timestamp DESC),
    INDEX idx_message_id (message_id),
    INDEX idx_from_me (from_me),
    INDEX idx_message_type (message_type)
);

CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    is_group BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    jid VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    push_name VARCHAR(255),
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Timestamp Conversion

Baileys provides Unix timestamps in seconds. Convert to JavaScript Date:

```typescript
const jsDate = new Date(msg.messageTimestamp * 1000)
const isoString = jsDate.toISOString()  // "2026-02-06T05:03:46.000Z"
```

## Full-Text Search Setup

For PostgreSQL full-text search on messages:

```sql
-- Add tsvector column
ALTER TABLE messages ADD COLUMN body_tsv tsvector;

-- Create index
CREATE INDEX idx_messages_fts ON messages USING GIN(body_tsv);

-- Auto-update trigger
CREATE FUNCTION messages_body_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.body_tsv := to_tsvector('english', COALESCE(NEW.body, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON messages FOR EACH ROW EXECUTE FUNCTION messages_body_tsv_trigger();

-- Search query
SELECT * FROM messages
WHERE body_tsv @@ to_tsquery('english', 'payment & customer')
ORDER BY timestamp DESC;
```

## Example: Processing Media Messages

```typescript
async function processMediaMessage(msg: any) {
    const mediaType = Object.keys(msg.message || {})[0]

    if (mediaType === 'imageMessage' ||
        mediaType === 'videoMessage' ||
        mediaType === 'documentMessage') {

        // Download media
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: pino({ level: 'silent' }),
                reuploadRequest: sock.updateMediaMessage
            }
        )

        // Upload to S3
        const s3Key = `media/${msg.key.id}.${getExtension(mediaType)}`
        await s3Client.upload({
            Bucket: 'whatsapp-media',
            Key: s3Key,
            Body: buffer,
            ContentType: msg.message[mediaType].mimetype
        })

        return `https://s3.amazonaws.com/whatsapp-media/${s3Key}`
    }

    return null
}
```

## Statistics from Real Export

From our test export of 677 messages:
- **Incoming**: 302 messages (44.6%)
- **Outgoing**: 375 messages (55.4%)
- **File size**: 247 KB
- **Date range**: ~6 days of conversation
- **Average**: ~113 messages per day
