# How to Sync Old WhatsApp Messages with Baileys

## Overview

This guide documents how to successfully retrieve historical WhatsApp messages using Baileys library. This was achieved after extensive testing and research.

## Key Discovery: `syncFullHistory` + Fresh Authentication

The secret to accessing historical messages is:

1. **Enable `syncFullHistory: true`** in Baileys configuration
2. **Use FRESH authentication** (delete existing session and rescan QR code)
3. **Listen to `messaging-history.set` event** to capture historical data

## Why This Works

WhatsApp sends historical message data **only during initial connection/pairing**. If you use an existing session, the `messaging-history.set` event **will not fire** with historical data.

## Implementation Steps

### Step 1: Delete Existing Session

```bash
trash auth_info/*
# or
rm -rf auth_info/*
```

### Step 2: Create Socket with `syncFullHistory`

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
    version,
    logger: pino({ level: 'warn' }),
    auth: state,
    syncFullHistory: true,  // THIS IS THE KEY!
})
```

### Step 3: Listen for History Sync Events

```typescript
sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
    console.log(`📥 History Sync Received:`)
    console.log(`   - Chats: ${chats.length}`)
    console.log(`   - Contacts: ${contacts.length}`)
    console.log(`   - Messages: ${messages.length}`)
    console.log(`   - Is Latest: ${isLatest}`)

    // Process and save messages to database here
    messages.forEach((msg) => {
        const remoteJid = msg.key.remoteJid  // Phone number or group ID
        const fromMe = msg.key.fromMe        // true if you sent it
        const text = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     null
        const timestamp = msg.messageTimestamp

        // Save to PostgreSQL, etc.
    })
})
```

### Step 4: Handle QR Code Authentication

```typescript
sock.ev.on('connection.update', async ({ qr }) => {
    if (qr) {
        // Display QR code for user to scan
        qrcode.generate(qr, { small: true })

        // Or save as image
        await QRCode.toFile('./qr.png', qr, { width: 600 })
    }
})
```

### Step 5: Save Credentials

```typescript
sock.ev.on('creds.update', saveCreds)
```

## Message Structure

Each message in the `messages` array has this structure:

```typescript
{
  key: {
    remoteJid: '919971115581@s.whatsapp.net',  // Contact/group ID
    fromMe: false,                              // Direction
    id: '3EB0XXXX',                            // Message ID
  },
  messageTimestamp: 1738825426,                 // Unix timestamp
  pushName: 'Vikas Agarwal',                   // Sender name
  message: {
    conversation: 'Hello',                      // Text message
    // OR
    extendedTextMessage: {
      text: 'Hello with formatting'
    },
    // OR
    imageMessage: { ... },                      // Media
    videoMessage: { ... },
    documentMessage: { ... }
  }
}
```

## Searching for Specific Contacts

To find messages from a specific contact, search by **JID (phone number)**, not by name:

```typescript
const TARGET_JID = '919971115581@s.whatsapp.net'

messages.forEach((msg) => {
    if (msg.key.remoteJid === TARGET_JID) {
        // This is a message from/to this contact
        vikasMessages.push(msg)
    }
})
```

## History Sync Batches

WhatsApp sends history in **multiple batches**:

```
📥 History Sync Received:
   - Chats: 500
   - Contacts: 500
   - Messages: 923
   - Is Latest: true      ← First batch

📥 History Sync Received:
   - Chats: 72
   - Contacts: 119
   - Messages: 4410
   - Is Latest: false     ← Subsequent batches
```

The event fires **multiple times**. Keep appending messages until you receive a batch with `isLatest: true`.

## Limitations

1. **~100k messages per chat** - WhatsApp has a hard limit on history sync
2. **One-time sync** - History sync only happens on fresh authentication
3. **No on-demand fetch** - You cannot request specific date ranges
4. **Recent messages prioritized** - Older messages may not sync if limit exceeded

## Avoiding WhatsApp Bans

### Safe Practices:

✅ **DO:**
- Use `syncFullHistory: true` only on initial setup
- After initial sync, rely on real-time `messages.upsert` events
- Keep connection alive for ongoing message capture
- Save credentials properly with `saveCreds`

❌ **DON'T:**
- Repeatedly delete session and rescan (looks suspicious)
- Request history sync on every connection
- Make frequent reconnections
- Use multiple devices simultaneously on same account

### Production Workflow:

1. **Initial Setup** (one-time):
   - Delete session → Scan QR → Enable `syncFullHistory: true` → Capture all history

2. **Ongoing Operation**:
   - Keep session alive → Use `messages.upsert` for new messages → No history sync needed

## Complete Working Example

See `find-vikas-messages.ts` for a complete implementation that:
- Handles QR code authentication
- Captures historical messages
- Filters by contact JID
- Exports to JSON
- Separates incoming vs outgoing messages

## Replacing In-Memory Store with PostgreSQL

The recommended architecture for production:

```typescript
sock.ev.on('messaging-history.set', async ({ messages }) => {
    for (const msg of messages) {
        await db.query(`
            INSERT INTO messages (
                message_id,
                chat_id,
                from_me,
                timestamp,
                body,
                message_type,
                media_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO NOTHING
        `, [
            msg.key.id,
            msg.key.remoteJid,
            msg.key.fromMe,
            new Date(msg.messageTimestamp * 1000),
            msg.message?.conversation || null,
            Object.keys(msg.message || {})[0],
            null  // Process media separately
        ])
    }
})

// Also capture real-time messages
sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
        // Save to PostgreSQL same way
    }
})
```

## Troubleshooting

### `messaging-history.set` event not firing

**Solution:** Delete `auth_info/*` and rescan QR code

### Getting old messages but not the target contact

**Solution:** Search by JID (phone number), not pushName

### Messages stop syncing after first batch

**Solution:** Wait 2-3 minutes, multiple batches arrive over time

### "No session found to decrypt message" errors

**Solution:** Normal for status broadcasts and encrypted group messages, ignore these

## References

- GitHub Issue #98: https://github.com/WhiskeySockets/Baileys/issues/98
- Working example: `jlucaso1/whatsapp-mcp-ts` repository
- Our successful implementation: `find-vikas-messages.ts`
