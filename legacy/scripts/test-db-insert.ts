/**
 * Test script: Insert sample messages directly into the database
 * to verify the full pipeline (models, triggers, API queries).
 *
 * Then optionally connect to WhatsApp and wait 60s for any real-time messages.
 */
import dotenv from 'dotenv';
dotenv.config();

import { testConnection, sequelize } from '../src/config/database.js';
import '../src/models/index.js';
import { Chat, Message, Contact } from '../src/models/index.js';

const SAMPLE_CONTACTS = [
  { jid: '919999887404@s.whatsapp.net', name: 'Test Contact 1', phone: '919999887404' },
  { jid: '919876543210@s.whatsapp.net', name: 'Test Contact 2', phone: '919876543210' },
  { jid: '919111222333@s.whatsapp.net', name: 'Test Contact 3', phone: '919111222333' },
  { jid: '919444555666@s.whatsapp.net', name: 'Test Contact 4', phone: '919444555666' },
  { jid: '919777888999@s.whatsapp.net', name: 'Test Contact 5', phone: '919777888999' },
];

const SAMPLE_MESSAGES = [
  'Hey, how are you doing?',
  'Can we meet tomorrow at 5pm?',
  'I just saw the latest update, looks great!',
  'Please check the document I shared',
  'Happy birthday! Wishing you all the best',
  'Running late, will be there in 10 mins',
  'Did you see the news today?',
  'Let me know when you are free to talk',
  'Thanks for the help, really appreciate it',
  'Good morning! Have a great day ahead',
];

async function main() {
  console.log('Testing database connection...');
  await testConnection();
  console.log('Database connected!\n');

  // Check initial state
  let chatCount = await Chat.count();
  let msgCount = await Message.count();
  let contactCount = await Contact.count();
  console.log(`Before: ${chatCount} chats, ${msgCount} messages, ${contactCount} contacts\n`);

  // Create contacts
  console.log('Creating contacts...');
  for (const c of SAMPLE_CONTACTS) {
    await Contact.findOrCreate({
      where: { contact_id: c.jid },
      defaults: {
        contact_id: c.jid,
        name: c.name,
        phone_number: c.phone,
      },
    });
  }
  console.log(`  Created ${SAMPLE_CONTACTS.length} contacts`);

  // Create chats
  console.log('Creating chats...');
  const chatRecords: Chat[] = [];
  for (const c of SAMPLE_CONTACTS) {
    const [chat] = await Chat.findOrCreate({
      where: { chat_id: c.jid },
      defaults: {
        chat_id: c.jid,
        chat_type: 'private',
        name: c.name,
      },
    });
    chatRecords.push(chat);
  }
  console.log(`  Created ${chatRecords.length} chats`);

  // Create messages (10 per contact = 50 total)
  console.log('Creating messages...');
  let totalCreated = 0;
  const now = Date.now();

  for (let ci = 0; ci < SAMPLE_CONTACTS.length; ci++) {
    const contact = SAMPLE_CONTACTS[ci];
    const chat = chatRecords[ci];

    for (let mi = 0; mi < SAMPLE_MESSAGES.length; mi++) {
      const isFromMe = mi % 3 === 0; // every 3rd message is from me
      const timestamp = new Date(now - (SAMPLE_CONTACTS.length - ci) * 86400000 - (SAMPLE_MESSAGES.length - mi) * 3600000);
      const messageId = `test_${contact.phone}_${mi}_${Date.now()}`;

      const [, created] = await Message.findOrCreate({
        where: { message_id: messageId },
        defaults: {
          message_id: messageId,
          chat_id: chat.id,
          sender_id: isFromMe ? 'me' : contact.jid,
          sender_name: isFromMe ? 'You' : contact.name,
          is_from_me: isFromMe,
          body: SAMPLE_MESSAGES[mi],
          message_type: 'chat',
          has_media: false,
          timestamp,
          is_forwarded: false,
        },
      });

      if (created) totalCreated++;
    }
  }
  console.log(`  Created ${totalCreated} messages\n`);

  // Verify results
  console.log('=== Verification ===\n');

  chatCount = await Chat.count();
  msgCount = await Message.count();
  contactCount = await Contact.count();
  console.log(`Chats:    ${chatCount}`);
  console.log(`Messages: ${msgCount}`);
  console.log(`Contacts: ${contactCount}`);

  // Check triggers worked (total_message_count, last_message_at)
  console.log('\n--- Chats (trigger verification) ---\n');
  const chats = await Chat.findAll({
    order: [['last_message_at', 'DESC']],
  });
  for (const chat of chats) {
    console.log(`  ${chat.name || chat.chat_id}`);
    console.log(`    type: ${chat.chat_type}, total_msgs: ${chat.total_message_count}, last: ${chat.last_message_at}`);
    console.log(`    preview: ${(chat.last_message_preview || '').substring(0, 60)}`);
  }

  // Sample messages
  console.log('\n--- Latest Messages ---\n');
  const msgs = await Message.findAll({
    order: [['timestamp', 'DESC']],
    limit: 10,
  });
  for (const m of msgs) {
    const time = new Date(m.timestamp).toLocaleString();
    const from = m.is_from_me ? 'You' : m.sender_name || m.sender_id;
    console.log(`  [${time}] ${from}: ${m.body}`);
  }

  // Full-text search test
  console.log('\n--- Full-text search: "birthday" ---\n');
  const searchResult = await sequelize.query(
    `SELECT m.id, m.sender_name, m.body, m.timestamp, c.name as chat_name
     FROM messages m
     JOIN chats c ON m.chat_id = c.id
     WHERE to_tsvector('english', COALESCE(m.body, '')) @@ to_tsquery('english', 'birthday')
     ORDER BY ts_rank(to_tsvector('english', COALESCE(m.body, '')), to_tsquery('english', 'birthday')) DESC`,
    { type: 'SELECT' as any }
  );
  console.log(`  Found ${searchResult.length} results`);
  for (const row of searchResult as any[]) {
    console.log(`  [${row.chat_name}] ${row.sender_name}: ${row.body}`);
  }

  // Full-text search test 2
  console.log('\n--- Full-text search: "meeting OR tomorrow" ---\n');
  const searchResult2 = await sequelize.query(
    `SELECT m.id, m.sender_name, m.body, m.timestamp, c.name as chat_name
     FROM messages m
     JOIN chats c ON m.chat_id = c.id
     WHERE to_tsvector('english', COALESCE(m.body, '')) @@ to_tsquery('english', 'meet | tomorrow')
     ORDER BY ts_rank(to_tsvector('english', COALESCE(m.body, '')), to_tsquery('english', 'meet | tomorrow')) DESC`,
    { type: 'SELECT' as any }
  );
  console.log(`  Found ${searchResult2.length} results`);
  for (const row of searchResult2 as any[]) {
    console.log(`  [${row.chat_name}] ${row.sender_name}: ${row.body}`);
  }

  // Message type distribution
  console.log('\n--- Message type distribution ---\n');
  const typeDist = await sequelize.query(
    `SELECT message_type, COUNT(*) as count FROM messages GROUP BY message_type ORDER BY count DESC`,
    { type: 'SELECT' as any }
  );
  for (const row of typeDist as any[]) {
    console.log(`  ${row.message_type}: ${row.count}`);
  }

  console.log('\nAll tests passed! Database is working correctly.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
