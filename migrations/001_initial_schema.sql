-- WhatsApp Logger Schema
-- Version: 001_initial_schema

-- ============================================
-- CHATS/CONVERSATIONS TABLE
-- ============================================
CREATE TABLE chats (
  id BIGSERIAL PRIMARY KEY,
  chat_id VARCHAR(255) UNIQUE NOT NULL,
  chat_type VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  description TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT DEFAULT 0,
  total_message_count BIGINT DEFAULT 0,
  participant_count INT,
  is_read_only BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_chat_type CHECK (chat_type IN ('private', 'group', 'broadcast'))
);

CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
CREATE INDEX idx_chats_pinned_archived ON chats(is_pinned DESC, is_archived, last_message_at DESC);
CREATE INDEX idx_chats_type ON chats(chat_type);
CREATE INDEX idx_chats_metadata ON chats USING GIN(metadata);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  contact_id VARCHAR(100) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  name VARCHAR(255),
  nickname VARCHAR(255),
  about TEXT,
  avatar_url TEXT,
  is_business BOOLEAN DEFAULT FALSE,
  is_enterprise BOOLEAN DEFAULT FALSE,
  business_profile JSONB,
  metadata JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_metadata ON contacts USING GIN(metadata);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id VARCHAR(100) NOT NULL,
  sender_name VARCHAR(255),
  is_from_me BOOLEAN DEFAULT FALSE,
  body TEXT,
  message_type VARCHAR(50) NOT NULL,
  has_media BOOLEAN DEFAULT FALSE,
  media_url TEXT,
  media_filename VARCHAR(500),
  media_mimetype VARCHAR(100),
  media_size BIGINT,
  media_caption TEXT,
  thumbnail_url TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  is_forwarded BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  quoted_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  status VARCHAR(20),
  mentions JSONB,
  reactions JSONB,
  poll_data JSONB,
  location_data JSONB,
  contact_data JSONB,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_message_type CHECK (message_type IN (
    'chat', 'image', 'video', 'audio', 'document', 'sticker',
    'ptt', 'location', 'contact', 'poll', 'system', 'reaction',
    'protocol', 'revoke', 'unknown'
  ))
);

CREATE INDEX idx_messages_chat_timestamp ON messages(chat_id, timestamp DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_has_media ON messages(has_media) WHERE has_media = TRUE;
CREATE INDEX idx_messages_quoted ON messages(quoted_message_id) WHERE quoted_message_id IS NOT NULL;
CREATE INDEX idx_messages_body_fts ON messages USING GIN(to_tsvector('english', COALESCE(body, '')));
CREATE INDEX idx_messages_mentions ON messages USING GIN(mentions) WHERE mentions IS NOT NULL;
CREATE INDEX idx_messages_reactions ON messages USING GIN(reactions) WHERE reactions IS NOT NULL;
CREATE INDEX idx_messages_raw_data ON messages USING GIN(raw_data);

-- ============================================
-- MESSAGE MEDIA TABLE
-- ============================================
CREATE TABLE message_media (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 's3',
  storage_key TEXT NOT NULL,
  storage_url TEXT,
  filename VARCHAR(500),
  mimetype VARCHAR(100),
  size_bytes BIGINT,
  duration_seconds INT,
  width INT,
  height INT,
  is_processed BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_message ON message_media(message_id);
CREATE INDEX idx_media_type ON message_media(mimetype);

-- ============================================
-- GROUP METADATA TABLE
-- ============================================
CREATE TABLE group_metadata (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  subject_owner VARCHAR(100),
  subject_time TIMESTAMPTZ,
  owner VARCHAR(100),
  creation_time TIMESTAMPTZ,
  community_id VARCHAR(255),
  is_community BOOLEAN DEFAULT FALSE,
  is_community_announce BOOLEAN DEFAULT FALSE,
  announce BOOLEAN DEFAULT FALSE,
  restrict_mode BOOLEAN DEFAULT FALSE,
  join_approval_mode BOOLEAN DEFAULT FALSE,
  member_add_mode BOOLEAN DEFAULT FALSE,
  description TEXT,
  description_id VARCHAR(255),
  ephemeral_duration INT,
  invite_code VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_group_chat UNIQUE (chat_id)
);

CREATE INDEX idx_group_metadata_chat ON group_metadata(chat_id);
CREATE INDEX idx_group_metadata_owner ON group_metadata(owner);
CREATE INDEX idx_group_metadata_community ON group_metadata(community_id) WHERE community_id IS NOT NULL;

-- ============================================
-- GROUP PARTICIPANTS TABLE
-- ============================================
CREATE TABLE group_participants (
  id BIGSERIAL PRIMARY KEY,
  group_metadata_id BIGINT NOT NULL REFERENCES group_metadata(id) ON DELETE CASCADE,
  participant_jid VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_role CHECK (role IN ('member', 'admin', 'super_admin')),
  CONSTRAINT unique_participant_group UNIQUE (group_metadata_id, participant_jid)
);

CREATE INDEX idx_group_participants_group ON group_participants(group_metadata_id);
CREATE INDEX idx_group_participants_jid ON group_participants(participant_jid);
CREATE INDEX idx_group_participants_role ON group_participants(role) WHERE role != 'member';
CREATE INDEX idx_group_participants_active ON group_participants(is_active) WHERE is_active = TRUE;

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

CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON message_media
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_group_metadata_updated_at BEFORE UPDATE ON group_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_group_participants_updated_at BEFORE UPDATE ON group_participants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
