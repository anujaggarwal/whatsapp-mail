# CLAUDE.md - WhatsApp Chat Logger & Analytics System

## Project Overview

This is a production-ready WhatsApp message logging system designed for personal backup, analytics, RAG (Retrieval Augmented Generation), and automation capabilities with a Gmail-like chat interface.

**Core Functionality:**
- Message logging (text, media, reactions, polls, etc.)
- Media storage to AWS S3
- Thread/conversation organization
- Full-text search across all messages
- Analytics-ready PostgreSQL schema
- Future RAG support with vector embeddings

## Technology Stack

**Backend:**
- Node.js with TypeScript
- Baileys (`@whiskeysockets/baileys`) - WhatsApp Web API client
- PostgreSQL - Primary database with full-text search and future pgvector support
- Express.js - REST API
- Sequelize - ORM for PostgreSQL
- AWS S3 - Media file storage
- Pino - Logging

**Package Manager:** pnpm (ALWAYS use pnpm, never npm or yarn)

**Key Libraries:**
- `@whiskeysockets/baileys` - WhatsApp integration
- `pg` + `sequelize` - Database
- `@aws-sdk/client-s3` - S3 uploads
- `express`, `cors`, `helmet` - API server
- `sharp` - Image processing (optional)
- `qrcode-terminal` - QR code display

## Development Environment

### Local Setup (Mac)

**CRITICAL:** This is a LOCAL development environment, NOT a production server.

**Server Commands:**
```bash
# Backend
pnpm dev          # Development with auto-reload
pnpm start        # Production mode
pnpm build        # Compile TypeScript

# Database
psql whatsapp_logger    # Connect to database
```

**Server URLs:**
- Backend API: http://localhost:3001
- Database: localhost:5432

**DO NOT use PM2 commands** - this is local development only.

### Environment Variables

Required `.env` file:
```bash
NODE_ENV=development

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

# Media settings
SAVE_MEDIA_TYPES=image,video,document
MAX_MEDIA_SIZE_MB=50
```

## Database Safety Rules

### CRITICAL: PostgreSQL Database Operations

**MANDATORY REQUIREMENTS:**

1. **ALWAYS backup before destructive operations:**
   ```bash
   # Backup entire database
   pg_dump whatsapp_logger > backup_$(date +%Y%m%d_%H%M%S).sql

   # Backup specific table
   pg_dump whatsapp_logger -t messages > messages_backup.sql
   ```

2. **NEVER run these commands without explicit user approval:**
   - `DROP TABLE`
   - `DROP DATABASE`
   - `TRUNCATE`
   - `DELETE FROM ... WHERE` (large-scale deletions)
   - `ALTER TABLE ... DROP COLUMN`
   - Any schema-altering DDL statements

3. **Safe to run without approval:**
   - `SELECT` queries (read-only)
   - `INSERT` single records for testing
   - `VACUUM ANALYZE`
   - `EXPLAIN ANALYZE`
   - Index creation/deletion (non-destructive)

4. **Migration Protocol:**
   - Create migration file in `migrations/` directory
   - Test on local database first
   - Show user the migration SQL before running
   - Create backup before applying
   - Only run after explicit user approval

### Database Schema Integrity

**Key Tables:**
- `chats` - Conversations/threads
- `messages` - All messages with full metadata
- `contacts` - Contact information
- `message_media` (optional) - Separate media storage table

**Important Triggers:**
- `trg_update_chat_timestamp` - Auto-updates chat last_message_at
- `trg_*_updated_at` - Auto-updates updated_at timestamps

**NEVER modify or drop these triggers without user approval.**

## Architecture Patterns

### Project Structure

```
whatsapp-logger/
├── src/
│   ├── config/          # Database, Baileys, S3 config
│   ├── models/          # Sequelize models (Chat, Message, Contact)
│   ├── services/        # Business logic (WhatsApp, Storage, Search)
│   ├── handlers/        # Event handlers (Message, Media, Chat)
│   ├── api/            # Express routes and server
│   └── utils/          # Logger, helpers
├── migrations/         # Database migrations
├── auth_info/         # Baileys session files (DO NOT COMMIT)
├── .env              # Environment variables (DO NOT COMMIT)
└── README.md
```

### Key Services

**WhatsAppService** (`src/services/whatsapp.service.ts`)
- Initializes Baileys socket connection
- Handles QR code authentication
- Manages connection state
- Emits events for messages, chats, contacts
- Uses `makeInMemoryStore` for message caching

**MessageHandler** (`src/handlers/message.handler.ts`)
- Processes incoming messages
- Extracts metadata (sender, timestamp, type)
- Handles media downloads
- Saves to PostgreSQL
- Updates chat metadata

**StorageService** (`src/services/storage.service.ts`)
- Uploads media to S3
- Generates presigned URLs
- Handles media type filtering
- Manages file size limits

### Coding Conventions

1. **TypeScript strict mode enabled**
2. **Use async/await** (not callbacks or .then())
3. **Error handling:**
   - Always wrap database operations in try/catch
   - Log errors with Pino logger
   - Return proper HTTP status codes in API
4. **Database queries:**
   - Use Sequelize for CRUD operations
   - Raw SQL for complex analytics queries
   - Always use prepared statements (prevent SQL injection)
5. **Baileys events:**
   - Use `messages.upsert` for new messages
   - Use `messages.update` for reactions/deletions
   - Use `chats.update` for chat metadata changes

## Testing Requirements

### Before Any Commit

**MANDATORY - ALL conditions must be met:**

1. **Build Verification:**
   ```bash
   pnpm build
   ```
   - Must complete without TypeScript errors
   - Check for any type errors or warnings

2. **Database Integrity:**
   ```bash
   psql whatsapp_logger -c "\d messages"    # Verify schema
   psql whatsapp_logger -c "SELECT COUNT(*) FROM messages"  # Check data
   ```
   - Verify tables exist and have correct schema
   - Check triggers are functioning
   - Verify indexes are created

3. **Runtime Testing (User must test):**
   - Start fresh server: `pnpm dev`
   - Test WhatsApp connection (QR code if new)
   - Send test messages and verify they're saved
   - Check media downloads and S3 uploads
   - Test API endpoints (GET /chats, GET /messages/:chatId)
   - Verify no console errors or crashes
   - Check database for saved messages

4. **User Explicit Approval Required:**
   - User must say "commit", "save", "push", "create commit", or "go ahead"
   - User must confirm testing is complete
   - Only then proceed with git commands

**PROFESSIONAL CONDUCT:**
- ❌ **DO NOT** ask for commits after each change
- ❌ **DO NOT** push user to commit
- ✅ **DO** wait for user to initiate commit after testing
- ✅ **DO** respect that real-world testing is user's responsibility

## Common Development Commands

### Package Management (pnpm only)

```bash
pnpm install                    # Install dependencies
pnpm add <package>              # Add dependency
pnpm add -D <package>           # Add dev dependency
pnpm remove <package>           # Remove dependency
pnpm update                     # Update dependencies
```

### Development

```bash
pnpm dev                        # Start development server with auto-reload
pnpm build                      # Compile TypeScript to dist/
pnpm start                      # Run production build
pnpm typecheck                  # Check TypeScript types without building
```

### Database

```bash
# PostgreSQL operations
psql whatsapp_logger            # Connect to database
psql whatsapp_logger -c "SELECT COUNT(*) FROM messages"
pg_dump whatsapp_logger > backup.sql

# Run migrations (manual)
psql whatsapp_logger < migrations/001_initial_schema.sql
```

### Debugging

```bash
# Check if WhatsApp is connected
tail -f logs/app.log

# Check database connection
psql whatsapp_logger -c "SELECT 1"

# Check S3 access
aws s3 ls s3://whatsapp-media

# Kill server on port
lsof -ti:3001 | xargs kill
```

## Baileys-Specific Guidelines

### WhatsApp Session Management

**Session files location:** `./auth_info/`
- Contains credentials and encryption keys
- **NEVER commit these files to git**
- Add to `.gitignore`

**First-time authentication:**
1. Run `pnpm dev`
2. QR code appears in terminal
3. Scan with WhatsApp mobile app (Settings → Linked Devices)
4. Session saved automatically
5. Subsequent runs use saved session

**Reconnection handling:**
- Auto-reconnect on connection drop (unless logged out)
- Exponential backoff recommended
- Monitor `connection.update` events

### Message Event Handling

**Event Types:**
- `messages.upsert` - New messages received
- `messages.update` - Message edits, deletions, reactions
- `chats.update` - Chat metadata changes (name, mute, archive)
- `contacts.update` - Contact info updates
- `creds.update` - Credentials refresh (auto-save required)

**Message Types:**
- `chat` - Text messages
- `image`, `video`, `audio`, `document` - Media
- `sticker`, `ptt` (voice note)
- `location`, `contact`, `poll` - Special types
- `system` - System messages (group changes, etc.)

### Media Handling Best Practices

1. **Filter media types** before downloading (use SAVE_MEDIA_TYPES env var)
2. **Check file size** before S3 upload (use MAX_MEDIA_SIZE_MB)
3. **Generate thumbnails** for videos/documents
4. **Use presigned URLs** with expiration (7 days recommended)
5. **Process media asynchronously** to avoid blocking message handler

## PostgreSQL-Specific Features

### Full-Text Search

```sql
-- Search messages (already indexed with GIN)
SELECT * FROM messages
WHERE to_tsvector('english', COALESCE(body, '')) @@ to_tsquery('english', 'search & term')
ORDER BY ts_rank(to_tsvector('english', body), to_tsquery('english', 'search & term')) DESC;
```

### JSONB Queries

```sql
-- Find messages with specific reaction
SELECT * FROM messages
WHERE reactions @> '{"👍": ["919876543210@c.us"]}'::jsonb;

-- Find messages mentioning user
SELECT * FROM messages
WHERE mentions @> '["919876543210@c.us"]'::jsonb;
```

### Future: pgvector for RAG

```sql
-- Will be added in Phase 3
CREATE EXTENSION vector;
ALTER TABLE messages ADD COLUMN embedding vector(1536);
CREATE INDEX ON messages USING ivfflat (embedding vector_cosine_ops);
```

## Security & Privacy

### Sensitive Files (NEVER COMMIT)

- `.env` - Environment variables
- `auth_info/` - WhatsApp session
- `*.json` (Baileys store files)
- `backup_*.sql` - Database backups
- Any files containing phone numbers or personal data

### API Security (Future)

- Add JWT authentication for API endpoints
- Rate limiting (express-rate-limit)
- CORS configuration for frontend
- Helmet.js for security headers
- Input validation and sanitization

### Data Privacy

- Messages contain personal data - handle with care
- Use presigned S3 URLs (not public URLs)
- Encrypt backups if storing offsite
- Consider GDPR compliance if applicable

## Git Commit Signature Format

All git commit messages must end with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: ANUJ AGGARWAL <anuj.aggarwal@gmail.com>
```

**NEVER use Claude's signature.** ALWAYS use ANUJ AGGARWAL's email.

## CRITICAL: Safe File Deletion

**MANDATORY:** Always use `trash` instead of `rm` on Mac.

```bash
# ✅ CORRECT - Reversible deletion
trash file.txt
trash -r directory/

# ❌ WRONG - Permanent deletion
rm file.txt
rm -rf directory/
```

**Exception:** For database drops/truncates, still require explicit approval even with backups.

## Project Phases & Roadmap

### Phase 1: Core Functionality (Current)
- [x] PostgreSQL schema design
- [ ] Baileys integration and authentication
- [ ] Message logging (text + metadata)
- [ ] Media handling (download + S3 upload)
- [ ] Basic Express API
- [ ] Contact and chat metadata sync

### Phase 2: Search & Analytics
- [ ] Full-text search API endpoint
- [ ] Analytics queries (message stats, active contacts)
- [ ] Export functionality (JSON, CSV)
- [ ] Advanced filters (date range, sender, media type)

### Phase 3: RAG Integration
- [ ] pgvector extension installation
- [ ] Embedding generation (OpenAI API)
- [ ] Semantic search endpoint
- [ ] AI-powered chat summary

### Phase 4: Frontend
- [ ] Gmail-like web interface (React/Next.js)
- [ ] Real-time updates (WebSockets/SSE)
- [ ] Media gallery view
- [ ] Search UI with filters

### Phase 5: Multi-Account
- [ ] Support multiple WhatsApp accounts
- [ ] Account switching
- [ ] Separate schemas per account

## Troubleshooting Guide

### Common Issues

**QR Code Not Appearing:**
- Check `printQRInTerminal: true` in Baileys config
- Verify terminal supports UTF-8
- Try `qrcode-terminal` package manually

**Messages Not Being Saved:**
- Check database connection in logs
- Verify triggers exist: `\df` in psql
- Check Baileys event listeners are registered
- Verify message handler is being called

**Media Download Failures:**
- Check S3 credentials and permissions
- Verify media size limits
- Check network connectivity
- Review Baileys `downloadMediaMessage` errors

**High Memory Usage:**
- Disable `makeInMemoryStore` if not needed
- Process media in batches
- Increase Node heap: `node --max-old-space-size=4096`
- Check for memory leaks in event handlers

**Connection Drops:**
- Verify internet connection
- Check WhatsApp mobile app is online
- Implement exponential backoff for reconnection
- Monitor `connection.update` events

## Performance Considerations

### Query Optimization

1. **Always use indexes** for frequent queries
2. **Limit pagination** to 100 messages per page
3. **Use EXPLAIN ANALYZE** to debug slow queries
4. **Denormalize** when necessary (e.g., last_message_preview)
5. **Enable connection pooling** (max 20 connections)

### Scaling Strategies

**For millions of messages:**
- Partition `messages` table by month
- Archive old messages to separate tables
- Use read replicas for analytics queries
- Implement caching layer (Redis) for hot data

### Monitoring

Track these metrics:
- Message ingestion rate (messages/sec)
- Database size and growth
- Query latency (P95, P99)
- S3 storage costs
- Connection uptime percentage

## Resources & References

**Baileys Documentation:**
- GitHub: https://github.com/WhiskeySockets/Baileys
- Wiki: https://baileys.wiki/
- Migration Guide: https://whiskey.so/migrate-latest
- Example: https://github.com/jlucaso1/whatsapp-mcp-ts

**PostgreSQL:**
- Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- JSONB: https://www.postgresql.org/docs/current/datatype-json.html
- pgvector: https://github.com/pgvector/pgvector

**Best Practices:**
- Chat System Design: Study Discord, Slack architectures
- Time-series optimization for message tables
- Efficient media CDN patterns

---

## Current Implementation Priority

**Next Steps:**
1. Set up PostgreSQL database and run schema
2. Implement WhatsAppService with Baileys authentication
3. Implement MessageHandler for basic message saving
4. Test with real WhatsApp messages
5. Add media download and S3 upload
6. Create basic API endpoints (GET /chats, GET /messages/:chatId)
7. Add error handling and logging
8. Write integration tests

**Focus Area:** Get core message logging working end-to-end before adding advanced features.
