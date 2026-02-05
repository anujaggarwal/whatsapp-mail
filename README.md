# WhatsApp Chat Logger & Analytics System

## Project Overview

A production-ready WhatsApp message logging system designed for:

- **Personal backup** of all WhatsApp conversations
- **Analytics** and data analysis on chat history
- **RAG (Retrieval Augmented Generation)** for AI-powered chat search
- **Automation** capabilities for bulk messaging
- **Gmail-like chat interface** for browsing conversations

## Requirements

### Functional Requirements

1. **Message Logging**: Capture all incoming messages (text, media, reactions, etc.)
2. **Media Storage**: Selectively save media files to cloud storage (AWS S3)
3. **Thread Organization**: Group messages by conversation (like Gmail)
4. **Search**: Full-text search across all messages
5. **Analytics Ready**: Query-friendly schema for data analysis
6. **Future RAG**: Support for vector embeddings and semantic search

### Non-Functional Requirements

- 24/7 operation without message loss
- Low RAM usage for long-term deployment
- Fast queries for chat thread rendering
- Scalable to millions of messages
- Support for multiple WhatsApp accounts (future)

## Technology Stack Decision

### WhatsApp Client Library: **Baileys** (Recommended)

**Chosen:** `@whiskeysockets/baileys`

**Why Baileys over whatsapp-web.js?**

| Feature                | Baileys                         | whatsapp-web.js (current)   |
| ---------------------- | ------------------------------- | --------------------------- |
| **Architecture**       | WebSocket-based                 | Puppeteer/Chrome browser    |
| **RAM Usage**          | ~200MB                          | ~700MB (browser overhead)   |
| **Message Storage**    | `makeInMemoryStore` + custom DB | Custom DB only              |
| **Message Loss Risk**  | Lower                           | Higher (reported issues)    |
| **Performance**        | Faster (direct WebSocket)       | Slower (browser automation) |
| **Multi-device**       | Native support                  | Supported                   |
| **Complexity**         | More complex setup              | Simpler API                 |
| **Active Development** | v7.0+ (2026)                    | Mature but slower updates   |

**Key Advantage**: Baileys has built-in message capture via `makeInMemoryStore` that automatically listens to all chat events, reducing risk of missed messages.

**References:**

- GitHub: https://github.com/WhiskeySockets/Baileys
- Documentation: https://baileys.wiki/docs/intro/
- Examples: https://github.com/jlucaso1/whatsapp-mcp-ts (SQLite implementation)
- Migration Guide: https://whiskey.so/migrate-latest

### Database: **PostgreSQL** (Recommended)

**Why PostgreSQL over MySQL/SQLite/MongoDB?**

| Requirement              | PostgreSQL                      | MySQL                | SQLite        | MongoDB                 |
| ------------------------ | ------------------------------- | -------------------- | ------------- | ----------------------- |
| **Thread Queries**       | ✅ Excellent (CTEs, Window Fns) | ✅ Good              | ⚠️ Limited    | ✅ Good                 |
| **Full-Text Search**     | ✅ Built-in GIN indexes         | ⚠️ Basic             | ❌ Limited    | ⚠️ Atlas only           |
| **JSON Support**         | ✅ JSONB with indexes           | ⚠️ JSON (slower)     | ❌ TEXT only  | ✅ Native               |
| **Vector Search (RAG)**  | ✅ pgvector extension           | ❌ No native support | ❌ No support | ⚠️ Atlas Search         |
| **Scalability**          | ✅ Billions of rows             | ✅ Good              | ❌ GB limit   | ✅ Excellent            |
| **Analytics**            | ✅ Excellent (complex queries)  | ✅ Good              | ⚠️ Limited    | ⚠️ Aggregation pipeline |
| **Text-Heavy Workloads** | ✅ Optimized                    | ⚠️ Adequate          | ❌ Slow       | ✅ Good                 |

**Key Advantages for This Project:**

1. **Thread/Conversation Queries**: Perfect for Gmail-like interface
2. **Full-Text Search**: Built-in `to_tsvector` and GIN indexes
3. **pgvector**: Add semantic search for RAG without changing databases
4. **JSONB**: Store flexible WhatsApp metadata (reactions, polls, etc.)
5. **Partitioning**: Split tables by date for massive histories
6. **Proven**: Used by Discord, Slack for chat systems

## Database Schema Design

### Core Tables

```sql
-- ============================================
-- CHATS/CONVERSATIONS TABLE
-- ============================================
CREATE TABLE chats (
  id BIGSERIAL PRIMARY KEY,

  -- WhatsApp identifiers
  chat_id VARCHAR(255) UNIQUE NOT NULL,     -- e.g., "919876543210@c.us" or "12345@g.us"
  chat_type VARCHAR(20) NOT NULL,           -- 'private', 'group', 'broadcast'

  -- Display info
  name VARCHAR(255),                        -- Contact name or group name
  avatar_url TEXT,                          -- Profile picture URL
  description TEXT,                         -- Group description

  -- UI state
  is_archived BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,

  -- Thread metadata
  last_message_at TIMESTAMPTZ,              -- For sorting inbox
  last_message_preview TEXT,                -- Denormalized for performance
  unread_count INT DEFAULT 0,
  total_message_count BIGINT DEFAULT 0,

  -- Group-specific (if applicable)
  participant_count INT,
  is_read_only BOOLEAN DEFAULT FALSE,

  -- Flexible metadata storage
  metadata JSONB,                           -- Store any additional WhatsApp data

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_chat_type CHECK (chat_type IN ('private', 'group', 'broadcast'))
);

-- Indexes for chat queries
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
CREATE INDEX idx_chats_pinned_archived ON chats(is_pinned DESC, is_archived, last_message_at DESC);
CREATE INDEX idx_chats_type ON chats(chat_type);
CREATE INDEX idx_chats_metadata ON chats USING GIN(metadata);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,

  -- WhatsApp identifiers
  message_id VARCHAR(255) UNIQUE NOT NULL,  -- WhatsApp's unique message ID
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,

  -- Sender information
  sender_id VARCHAR(100) NOT NULL,          -- Phone number or contact ID
  sender_name VARCHAR(255),                 -- Display name at time of message
  is_from_me BOOLEAN DEFAULT FALSE,         -- Sent by me vs received

  -- Message content
  body TEXT,                                -- Message text (NULL for media-only)
  message_type VARCHAR(50) NOT NULL,        -- 'chat', 'image', 'video', 'audio', 'document', 'sticker', 'ptt', 'location', 'contact', 'poll'

  -- Media details
  has_media BOOLEAN DEFAULT FALSE,
  media_url TEXT,                           -- S3 URL or cloud storage link
  media_filename VARCHAR(500),
  media_mimetype VARCHAR(100),
  media_size BIGINT,                        -- In bytes
  media_caption TEXT,                       -- Caption for images/videos
  thumbnail_url TEXT,                       -- For videos/documents

  -- Message metadata
  timestamp TIMESTAMPTZ NOT NULL,           -- When message was sent/received
  is_forwarded BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,         -- Deleted by sender

  -- Thread/Reply context
  quoted_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,  -- Reply to another message

  -- Message status (for sent messages)
  status VARCHAR(20),                       -- 'pending', 'sent', 'delivered', 'read', 'failed'

  -- Rich content (reactions, mentions, polls, etc.)
  mentions JSONB,                           -- Array of mentioned contact IDs
  reactions JSONB,                          -- {emoji: [sender_ids]}
  poll_data JSONB,                          -- Poll questions and options
  location_data JSONB,                      -- {latitude, longitude, address}
  contact_data JSONB,                       -- vCard information

  -- Complete message object for reference/debugging
  raw_data JSONB,                           -- Full WhatsApp message object

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),     -- When saved to DB
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_message_type CHECK (message_type IN (
    'chat', 'image', 'video', 'audio', 'document', 'sticker',
    'ptt', 'location', 'contact', 'poll', 'system'
  ))
);

-- Indexes for message queries
CREATE INDEX idx_messages_chat_timestamp ON messages(chat_id, timestamp DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_has_media ON messages(has_media) WHERE has_media = TRUE;
CREATE INDEX idx_messages_quoted ON messages(quoted_message_id) WHERE quoted_message_id IS NOT NULL;

-- Full-text search index for message body
CREATE INDEX idx_messages_body_fts ON messages USING GIN(to_tsvector('english', COALESCE(body, '')));

-- JSONB indexes for metadata queries
CREATE INDEX idx_messages_mentions ON messages USING GIN(mentions) WHERE mentions IS NOT NULL;
CREATE INDEX idx_messages_reactions ON messages USING GIN(reactions) WHERE reactions IS NOT NULL;
CREATE INDEX idx_messages_raw_data ON messages USING GIN(raw_data);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,

  -- Identifiers
  contact_id VARCHAR(100) UNIQUE NOT NULL,  -- Phone number or WhatsApp ID
  phone_number VARCHAR(20),                 -- Normalized phone number

  -- Profile information
  name VARCHAR(255),                        -- Contact name
  nickname VARCHAR(255),                    -- Saved nickname
  about TEXT,                               -- WhatsApp status/about
  avatar_url TEXT,                          -- Profile picture URL

  -- Contact metadata
  is_business BOOLEAN DEFAULT FALSE,
  is_enterprise BOOLEAN DEFAULT FALSE,
  business_profile JSONB,                   -- Business info if applicable

  -- Flexible metadata
  metadata JSONB,

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contact queries
CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_metadata ON contacts USING GIN(metadata);

-- ============================================
-- MESSAGE MEDIA TABLE (Optional - for large scale)
-- ============================================
-- Separate table if you want to optimize media storage
CREATE TABLE message_media (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  -- Storage info
  storage_provider VARCHAR(50) NOT NULL,    -- 's3', 'gcs', 'local'
  storage_key TEXT NOT NULL,                -- S3 key or file path
  storage_url TEXT,                         -- Presigned or public URL

  -- Media details
  filename VARCHAR(500),
  mimetype VARCHAR(100),
  size_bytes BIGINT,
  duration_seconds INT,                     -- For audio/video
  width INT,                                -- For images/videos
  height INT,

  -- Processing status
  is_processed BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_message ON message_media(message_id);
CREATE INDEX idx_media_type ON message_media(mimetype);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update chat's last_message_at when new message arrives
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET
    last_message_at = NEW.timestamp,
    last_message_preview = LEFT(COALESCE(NEW.body, '[Media]'), 100),
    total_message_count = total_message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_chat_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chats_updated_at BEFORE UPDATE ON chats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Future: Vector Embeddings for RAG

```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to messages
ALTER TABLE messages ADD COLUMN embedding vector(1536);  -- OpenAI ada-002 dimension

-- Index for similarity search
CREATE INDEX idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- Adjust based on dataset size

-- Similarity search query example
-- SELECT * FROM messages
-- ORDER BY embedding <=> '[your_query_embedding]'::vector
-- LIMIT 10;
```

## Key Queries for Gmail-Like Interface

### 1. Inbox View (List All Conversations)

```sql
-- Get all conversations sorted by recent activity
SELECT
  c.id,
  c.chat_id,
  c.name,
  c.chat_type,
  c.avatar_url,
  c.last_message_at,
  c.last_message_preview,
  c.unread_count,
  c.is_pinned,
  c.is_archived,
  c.total_message_count
FROM chats c
WHERE c.is_archived = FALSE  -- Hide archived chats
ORDER BY
  c.is_pinned DESC,           -- Pinned chats first
  c.last_message_at DESC NULLS LAST
LIMIT 50 OFFSET :offset;

-- Get counts for UI
SELECT
  COUNT(*) FILTER (WHERE is_archived = FALSE) as active_chats,
  COUNT(*) FILTER (WHERE is_archived = TRUE) as archived_chats,
  SUM(unread_count) as total_unread
FROM chats;
```

### 2. Conversation/Thread View (All Messages in a Chat)

```sql
-- Get messages for a specific chat (paginated)
SELECT
  m.id,
  m.message_id,
  m.sender_id,
  m.sender_name,
  m.is_from_me,
  m.body,
  m.message_type,
  m.has_media,
  m.media_url,
  m.media_filename,
  m.media_caption,
  m.timestamp,
  m.is_forwarded,
  m.is_starred,
  m.mentions,
  m.reactions,
  -- Quoted message preview
  qm.body as quoted_message_body,
  qm.sender_name as quoted_sender_name,
  qm.message_type as quoted_message_type
FROM messages m
LEFT JOIN messages qm ON m.quoted_message_id = qm.id
WHERE m.chat_id = :chat_id
  AND m.is_deleted = FALSE
ORDER BY m.timestamp ASC  -- Chronological order
LIMIT 100 OFFSET :offset;

-- Get message count for pagination
SELECT COUNT(*) FROM messages
WHERE chat_id = :chat_id AND is_deleted = FALSE;
```

### 3. Full-Text Search Across All Messages

```sql
-- Search messages with ranking
SELECT
  m.id,
  m.body,
  m.timestamp,
  c.name as chat_name,
  c.chat_type,
  m.sender_name,
  ts_rank(
    to_tsvector('english', COALESCE(m.body, '')),
    query
  ) as rank
FROM messages m
JOIN chats c ON m.chat_id = c.id
CROSS JOIN to_tsquery('english', :search_query) query
WHERE to_tsvector('english', COALESCE(m.body, '')) @@ query
  AND m.is_deleted = FALSE
ORDER BY rank DESC, m.timestamp DESC
LIMIT 50;

-- Example search query transformation:
-- "hello world" -> 'hello & world'
-- "hello OR world" -> 'hello | world'
```

### 4. Media Gallery View

```sql
-- Get all media from a chat
SELECT
  m.id,
  m.message_id,
  m.media_url,
  m.media_filename,
  m.media_mimetype,
  m.media_caption,
  m.timestamp,
  m.sender_name
FROM messages m
WHERE m.chat_id = :chat_id
  AND m.has_media = TRUE
  AND m.media_mimetype LIKE 'image/%'  -- Filter by type
  AND m.is_deleted = FALSE
ORDER BY m.timestamp DESC
LIMIT 100;
```

### 5. Analytics Queries

```sql
-- Message count by day
SELECT
  DATE(timestamp) as date,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE has_media = TRUE) as media_count
FROM messages
WHERE chat_id = :chat_id
GROUP BY DATE(timestamp)
ORDER BY date DESC
LIMIT 30;

-- Most active contacts
SELECT
  sender_id,
  sender_name,
  COUNT(*) as message_count,
  MAX(timestamp) as last_message_at
FROM messages
WHERE is_from_me = FALSE
GROUP BY sender_id, sender_name
ORDER BY message_count DESC
LIMIT 20;

-- Message type distribution
SELECT
  message_type,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM messages
GROUP BY message_type
ORDER BY count DESC;
```

## Architecture & Implementation Guide

### Project Structure

```
whatsapp-logger/
├── src/
│   ├── config/
│   │   ├── database.ts          # PostgreSQL connection
│   │   ├── baileys.ts           # WhatsApp client config
│   │   └── s3.ts                # AWS S3 config
│   ├── models/
│   │   ├── Chat.ts              # Sequelize/Prisma model
│   │   ├── Message.ts
│   │   └── Contact.ts
│   ├── services/
│   │   ├── whatsapp.service.ts  # Baileys integration
│   │   ├── storage.service.ts   # S3 media upload
│   │   ├── message.service.ts   # Message processing
│   │   └── search.service.ts    # Full-text search
│   ├── handlers/
│   │   ├── message.handler.ts   # Process incoming messages
│   │   ├── media.handler.ts     # Handle media downloads
│   │   └── chat.handler.ts      # Chat metadata updates
│   ├── api/
│   │   ├── routes/
│   │   │   ├── chats.ts         # GET /chats, GET /chats/:id
│   │   │   ├── messages.ts      # GET /messages, POST /messages
│   │   │   └── search.ts        # GET /search
│   │   └── server.ts            # Express app
│   ├── utils/
│   │   ├── logger.ts            # Winston logger
│   │   └── helpers.ts
│   └── index.ts                 # Entry point
├── migrations/                   # Database migrations
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Baileys Integration Example

```typescript
// src/services/whatsapp.service.ts
import makeWASocket, {
  makeInMemoryStore,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

export class WhatsAppService {
  private sock: any;
  private store: any;

  async initialize() {
    // Create in-memory store for message caching
    this.store = makeInMemoryStore({
      logger: pino().child({ level: "silent", stream: "store" }),
    });

    // Optional: Read from file on startup
    this.store?.readFromFile("./baileys_store_multi.json");

    // Save store every 10 seconds
    setInterval(() => {
      this.store?.writeToFile("./baileys_store_multi.json");
    }, 10_000);

    // Multi-file auth state (stores session in ./auth_info/)
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    // Get latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    // Create socket connection
    this.sock = makeWASocket({
      version,
      logger: pino({ level: "warn" }),
      printQRInTerminal: true, // Show QR in terminal
      auth: state,
      // Puppeteer config if needed
      // browser: Browsers.macOS('Desktop'),
    });

    // Bind store to socket events
    this.store?.bind(this.sock.ev);

    // Save credentials on update
    this.sock.ev.on("creds.update", saveCreds);

    // Handle connection updates
    this.sock.ev.on("connection.update", (update) => {
      this.handleConnectionUpdate(update);
    });

    // Handle incoming messages
    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type === "notify") {
        for (const msg of messages) {
          await this.handleMessage(msg);
        }
      }
    });

    // Handle message updates (edits, deletions, reactions)
    this.sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        await this.handleMessageUpdate(update);
      }
    });

    // Handle chat updates
    this.sock.ev.on("chats.update", async (chats) => {
      for (const chat of chats) {
        await this.handleChatUpdate(chat);
      }
    });

    // Handle contact updates
    this.sock.ev.on("contacts.update", async (contacts) => {
      for (const contact of contacts) {
        await this.handleContactUpdate(contact);
      }
    });
  }

  private handleConnectionUpdate(update: any) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("QR Code:", qr);
      // You can also generate QR image and serve via API
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        this.initialize(); // Reconnect
      }
    } else if (connection === "open") {
      console.log("WhatsApp connection opened!");
    }
  }

  private async handleMessage(msg: any) {
    // Import message handler
    const { MessageHandler } = await import("../handlers/message.handler");
    await MessageHandler.process(msg, this.sock);
  }

  private async handleMessageUpdate(update: any) {
    // Handle reactions, deletions, edits
    const { key, update: msgUpdate } = update;

    if (msgUpdate.reactions) {
      // Update reactions in database
      await Message.update(
        { reactions: msgUpdate.reactions },
        { where: { message_id: key.id } },
      );
    }
  }

  private async handleChatUpdate(chat: any) {
    // Update chat metadata in database
    // (name changes, mute status, etc.)
  }

  private async handleContactUpdate(contact: any) {
    // Update contact info in database
  }

  async sendMessage(chatId: string, content: string) {
    await this.sock.sendMessage(chatId, { text: content });
  }

  async sendMedia(chatId: string, mediaUrl: string, caption?: string) {
    await this.sock.sendMessage(chatId, {
      image: { url: mediaUrl },
      caption,
    });
  }
}
```

### Message Handler Example

```typescript
// src/handlers/message.handler.ts
import { Chat, Message, Contact } from "../models";
import { StorageService } from "../services/storage.service";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export class MessageHandler {
  static async process(msg: any, sock: any) {
    try {
      // Extract message metadata
      const messageId = msg.key.id;
      const chatId = msg.key.remoteJid;
      const senderId = msg.key.participant || msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const timestamp = new Date(msg.messageTimestamp * 1000);

      // Determine message type
      const messageType = Object.keys(msg.message || {})[0];
      const messageContent = msg.message?.[messageType];

      // Get or create chat
      const [chat] = await Chat.findOrCreate({
        where: { chat_id: chatId },
        defaults: {
          chat_id: chatId,
          chat_type: chatId.endsWith("@g.us") ? "group" : "private",
          name: await this.getChatName(chatId, sock),
        },
      });

      // Extract message body
      let body =
        messageContent?.text ||
        messageContent?.caption ||
        messageContent?.conversation ||
        null;

      // Handle media
      let mediaUrl = null;
      let mediaFilename = null;
      let mediaMimetype = null;
      let mediaSize = null;

      if (
        msg.message?.imageMessage ||
        msg.message?.videoMessage ||
        msg.message?.audioMessage ||
        msg.message?.documentMessage
      ) {
        // Download media
        const buffer = await downloadMediaMessage(
          msg,
          "buffer",
          {},
          {
            logger: console,
            reuploadRequest: sock.updateMediaMessage,
          },
        );

        // Upload to S3
        const mediaInfo = await StorageService.uploadMedia(
          buffer,
          messageContent.mimetype,
          messageId,
        );

        mediaUrl = mediaInfo.url;
        mediaFilename = mediaInfo.filename;
        mediaMimetype = messageContent.mimetype;
        mediaSize = buffer.length;
      }

      // Extract quoted message
      let quotedMessageId = null;
      if (messageContent?.contextInfo?.stanzaId) {
        const quotedMsg = await Message.findOne({
          where: { message_id: messageContent.contextInfo.stanzaId },
        });
        quotedMessageId = quotedMsg?.id || null;
      }

      // Save to database
      await Message.create({
        message_id: messageId,
        chat_id: chat.id,
        sender_id: senderId,
        sender_name: msg.pushName || "Unknown",
        is_from_me: isFromMe,
        body,
        message_type: messageType,
        has_media: !!mediaUrl,
        media_url: mediaUrl,
        media_filename: mediaFilename,
        media_mimetype: mediaMimetype,
        media_size: mediaSize,
        timestamp,
        quoted_message_id: quotedMessageId,
        mentions: messageContent?.contextInfo?.mentionedJid || null,
        raw_data: msg,
      });

      console.log(`✅ Saved message ${messageId} from ${chatId}`);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private static async getChatName(chatId: string, sock: any): Promise<string> {
    try {
      if (chatId.endsWith("@g.us")) {
        const metadata = await sock.groupMetadata(chatId);
        return metadata.subject;
      } else {
        // Get contact name
        const contact = await sock.getContact(chatId);
        return contact.name || contact.notify || chatId.split("@")[0];
      }
    } catch {
      return chatId.split("@")[0];
    }
  }
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Create new project
mkdir whatsapp-logger && cd whatsapp-logger
pnpm init

# Install Baileys
pnpm add @whiskeysockets/baileys

# Install database & ORM
pnpm add pg sequelize
pnpm add -D @types/pg sequelize-cli

# Install S3 SDK
pnpm add @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner

# Install utilities
pnpm add dotenv express cors helmet pino qrcode-terminal
pnpm add -D typescript @types/node @types/express nodemon ts-node

# Optional: For image processing
pnpm add sharp
```

### 2. Environment Variables

```bash
# .env
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_logger
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_logger
DB_USER=postgres
DB_PASSWORD=your_password

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET=whatsapp-media

# Server
PORT=3001
API_BASE_URL=http://localhost:3001

# WhatsApp
WHATSAPP_SESSION_DIR=./auth_info
WHATSAPP_STORE_FILE=./baileys_store.json

# Optional: Media settings
SAVE_MEDIA_TYPES=image,video,document  # Comma-separated
MAX_MEDIA_SIZE_MB=50
```

### 3. Database Setup

```bash
# Create database
createdb whatsapp_logger

# Run migrations (copy schema from above)
psql whatsapp_logger < migrations/001_initial_schema.sql
```

### 4. Run the Application

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

### 5. First-Time Authentication

1. Run the application
2. QR code will appear in terminal
3. Scan with WhatsApp mobile app (Linked Devices)
4. Session saved in `./auth_info/` directory
5. Messages will start logging automatically

## Performance Optimization

### Database Partitioning (For Millions of Messages)

```sql
-- Partition messages by month
CREATE TABLE messages_2026_01 PARTITION OF messages
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE messages_2026_02 PARTITION OF messages
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Auto-create partitions via pg_partman or cron job
```

### Query Optimization Tips

1. **Use EXPLAIN ANALYZE** to identify slow queries
2. **Denormalize** frequently accessed data (e.g., last_message_preview)
3. **Limit pagination** to 100 messages per page
4. **Use prepared statements** to avoid SQL injection and improve performance
5. **Enable connection pooling** (max 20 connections recommended)

### Indexing Strategy

- **B-tree indexes**: For exact matches and ranges (timestamps, IDs)
- **GIN indexes**: For full-text search, JSONB, and arrays
- **Covering indexes**: Include frequently queried columns
- **Partial indexes**: Index only rows matching condition (e.g., `WHERE has_media = TRUE`)

## Monitoring & Maintenance

### Key Metrics to Track

1. **Message ingestion rate**: Messages/second
2. **Database size**: Track growth over time
3. **Query performance**: P95, P99 latency
4. **Media storage costs**: S3 usage
5. **Connection state**: WhatsApp disconnect/reconnect frequency

### Regular Maintenance

```sql
-- Vacuum and analyze regularly
VACUUM ANALYZE messages;
VACUUM ANALYZE chats;

-- Reindex if needed
REINDEX TABLE messages;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Security Considerations

1. **Encrypt session files**: Store `auth_info` securely
2. **Use environment variables**: Never commit credentials
3. **API authentication**: Add JWT or API keys for frontend
4. **Rate limiting**: Prevent abuse of search/query endpoints
5. **S3 presigned URLs**: Set expiration (e.g., 7 days)
6. **Database backups**: Daily backups with point-in-time recovery

## Future Enhancements

### Phase 1: Core Functionality ✅

- [x] Message logging with Baileys
- [x] Media storage to S3
- [x] PostgreSQL schema
- [x] Basic API endpoints

### Phase 2: Search & Analytics

- [ ] Full-text search API
- [ ] Message statistics dashboard
- [ ] Export conversations (PDF, JSON)
- [ ] Advanced filters (date range, sender, media type)

### Phase 3: RAG Integration

- [ ] Install pgvector extension
- [ ] Generate embeddings for messages (OpenAI API)
- [ ] Semantic search endpoint
- [ ] AI-powered chat summary

### Phase 4: Frontend

- [ ] Gmail-like web interface (React/Next.js)
- [ ] Real-time message updates (WebSockets)
- [ ] Media gallery view
- [ ] Chat search UI

### Phase 5: Multi-Account

- [ ] Support multiple WhatsApp accounts
- [ ] Account switching in UI
- [ ] Separate databases per account

## Troubleshooting

### Common Issues

**QR Code Not Appearing**

- Check terminal supports UTF-8
- Try `printQRInTerminal: true` in Baileys config
- Use `qrcode-terminal` package to manually generate

**Messages Not Saving**

- Check database connection
- Verify triggers are created
- Check application logs

**High Memory Usage**

- Disable `makeInMemoryStore` if not needed
- Increase Node.js heap: `node --max-old-space-size=4096`
- Process media in chunks

**Connection Drops**

- Check internet connection
- Increase Baileys timeout settings
- Implement exponential backoff for reconnection

## References & Resources

### Baileys Documentation

- GitHub: https://github.com/WhiskeySockets/Baileys
- Wiki: https://baileys.wiki/
- Migration Guide: https://whiskey.so/migrate-latest
- Example Implementation: https://github.com/jlucaso1/whatsapp-mcp-ts

### PostgreSQL Resources

- pgvector: https://github.com/pgvector/pgvector
- Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html

### Alternative Libraries (For Reference)

- whatsapp-web.js: https://github.com/pedroslopez/whatsapp-web.js (browser-based)
- Baileys vs WWebJS: https://whapi.cloud/best-wwebjs-whatsapp-web-js-alternative

---

## Getting Started Checklist

For the Claude Code instance building this project:

- [ ] Create project directory structure
- [ ] Install all dependencies via pnpm
- [ ] Set up PostgreSQL database
- [ ] Create database schema (run SQL from above)
- [ ] Configure environment variables (.env)
- [ ] Implement WhatsAppService with Baileys
- [ ] Implement MessageHandler for message processing
- [ ] Implement StorageService for S3 uploads
- [ ] Create Express API with chat/message endpoints
- [ ] Test QR code authentication
- [ ] Verify messages are being saved to database
- [ ] Test media download and S3 upload
- [ ] Implement search endpoint with full-text search
- [ ] Add logging and error handling
- [ ] Write basic tests
- [ ] Document API endpoints
- [ ] Create deployment guide

**Priority Order:**

1. Database setup (PostgreSQL + schema)
2. Baileys integration (authentication + message receiving)
3. Message handler (save to database)
4. Media handling (S3 storage)
5. API layer (Express endpoints)
6. Search functionality
7. Frontend (optional, separate phase)

Good luck! 🚀
