import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from './src'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'

const OUTPUT_FILE = './vikas_messages.json'
const VIKAS_JID = '919971115581@s.whatsapp.net'  // Target contact

const startConnection = async () => {
    console.log('🚀 Starting WhatsApp History Sync for Vikas Agarwal...\n')

    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const { version, isLatest } = await fetchLatestBaileysVersion()

    console.log(`📱 Using WA v${version.join('.')}\n`)

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'warn' }),
        printQRInTerminal: false,
        auth: state,
        syncFullHistory: true,
    })

    // Handle QR code
    sock.ev.on('connection.update', async ({ qr }) => {
        if (qr) {
            console.log('\n📱 Scan this QR code with your WhatsApp mobile app:\n')
            qrcode.generate(qr, { small: true })

            await QRCode.toFile('./whatsapp-history-qr.png', qr, { width: 600 })
            console.log('\n✅ QR code saved to: whatsapp-history-qr.png')
            console.log('🔄 Opening QR code image...\n')
            try {
                require('child_process').execSync('open whatsapp-history-qr.png')
            } catch {}
        }
    })

    sock.ev.on('creds.update', saveCreds)

    let allSyncedMessages: any[] = []
    let vikasMessages: any[] = []
    let foundVikas = false

    // THIS EVENT GETS HISTORICAL MESSAGES!
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
        console.log(`📥 History Sync Received:`)
        console.log(`   - Chats: ${chats.length}`)
        console.log(`   - Contacts: ${contacts.length}`)
        console.log(`   - Messages: ${messages.length}`)
        console.log(`   - Is Latest: ${isLatest}\n`)

        allSyncedMessages.push(...messages)

        // Check if Vikas contact exists
        contacts.forEach((contact: any) => {
            if (contact.id === VIKAS_JID) {
                foundVikas = true
                console.log(`✅ Found Vikas Agarwal in contacts:`)
                console.log(`   Name: ${contact.name || contact.notify}`)
                console.log(`   ID: ${contact.id}\n`)
            }
        })

        // Search for messages by JID (phone number)
        messages.forEach((msg: any) => {
            const remoteJid = msg.key.remoteJid
            const fromMe = msg.key.fromMe

            // Match messages from Vikas Agarwal's chat
            if (remoteJid === VIKAS_JID) {
                vikasMessages.push(msg)

                const text = msg.message?.conversation ||
                           msg.message?.extendedTextMessage?.text ||
                           '[Media]'
                const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString()
                const from = fromMe ? 'You' : 'Vikas Agarwal'

                console.log(`⭐ Message in Vikas Agarwal chat:`)
                console.log(`   Time: ${timestamp}`)
                console.log(`   From: ${from}`)
                console.log(`   Text: ${text.substring(0, 100)}`)
                console.log('')
            }
        })

        // Also check chats
        chats.forEach((chat: any) => {
            if (chat.id === VIKAS_JID) {
                console.log(`💬 Found Vikas Agarwal chat:`)
                console.log(`   Name: ${chat.name}`)
                console.log(`   ID: ${chat.id}`)
                console.log(`   Unread: ${chat.unreadCount || 0}`)
                console.log(`   Last Message: ${new Date(chat.conversationTimestamp * 1000).toLocaleString()}\n`)
            }
        })
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut

            if (shouldReconnect) {
                console.log('Reconnecting...')
                startConnection()
            } else {
                console.log('Logged out.')
                process.exit(0)
            }
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp!')
            console.log('⏳ Syncing full message history...')
            console.log(`   Looking for messages with: ${VIKAS_JID}`)
            console.log('   (This may take 1-5 minutes depending on chat history)\n')

            // Give it time to sync, then check results
            setTimeout(() => {
                console.log('\n' + '='.repeat(60))
                console.log('📊 SYNC SUMMARY')
                console.log('='.repeat(60))
                console.log(`Target Contact: Vikas Agarwal (${VIKAS_JID})`)
                console.log(`Contact Found: ${foundVikas ? '✅ Yes' : '❌ No'}`)
                console.log(`Total messages synced: ${allSyncedMessages.length}`)
                console.log(`Messages from Vikas Agarwal chat: ${vikasMessages.length}`)

                if (vikasMessages.length > 0) {
                    console.log(`\n🎉 SUCCESS! Found ${vikasMessages.length} messages in Vikas Agarwal chat`)

                    // Separate incoming vs outgoing
                    const incoming = vikasMessages.filter(m => !m.key.fromMe)
                    const outgoing = vikasMessages.filter(m => m.key.fromMe)

                    console.log(`   - Messages from Vikas: ${incoming.length}`)
                    console.log(`   - Messages from you: ${outgoing.length}`)

                    console.log(`\n📩 Last 5 messages:`)

                    vikasMessages.slice(-5).forEach((msg, idx) => {
                        const text = msg.message?.conversation ||
                                   msg.message?.extendedTextMessage?.text ||
                                   '[Media]'
                        const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString()
                        const from = msg.key.fromMe ? 'You' : 'Vikas'

                        console.log(`\n${idx + 1}. [${timestamp}] ${from}:`)
                        console.log(`   ${text.substring(0, 200)}`)
                    })

                    // Save to file
                    const exportData = {
                        exportDate: new Date().toISOString(),
                        targetContact: {
                            name: 'Vikas Agarwal',
                            jid: VIKAS_JID
                        },
                        totalMessages: vikasMessages.length,
                        incomingMessages: incoming.length,
                        outgoingMessages: outgoing.length,
                        messages: vikasMessages.map((msg: any) => ({
                            timestamp: msg.messageTimestamp,
                            date: new Date(msg.messageTimestamp * 1000).toISOString(),
                            fromMe: msg.key.fromMe,
                            pushName: msg.pushName,
                            text: msg.message?.conversation ||
                                  msg.message?.extendedTextMessage?.text ||
                                  null,
                            messageType: Object.keys(msg.message || {})[0],
                            hasMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage),
                            chatId: msg.key.remoteJid
                        }))
                    }

                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2))
                    console.log(`\n💾 Exported to: ${OUTPUT_FILE}`)
                } else {
                    if (!foundVikas) {
                        console.log(`\n⚠️  Contact "Vikas Agarwal" (${VIKAS_JID}) not found in contacts`)
                        console.log(`   This might mean:`)
                        console.log(`   - You don't have this contact saved`)
                        console.log(`   - The phone number is incorrect`)
                        console.log(`   - The contact was deleted`)
                    } else {
                        console.log(`\n⚠️  Contact found but no messages in synced history`)
                        console.log(`   This might mean:`)
                        console.log(`   - You haven't messaged this contact`)
                        console.log(`   - Messages are older than sync limit (~100k messages)`)
                        console.log(`   - Chat was deleted`)
                    }
                }

                console.log(`\n💡 Keep this running to capture more messages or press Ctrl+C to stop.\n`)

            }, 120000) // Wait 120 seconds (2 minutes) for sync
        }
    })
}

startConnection().catch(err => {
    console.error('Fatal Error:', err)
    process.exit(1)
})
