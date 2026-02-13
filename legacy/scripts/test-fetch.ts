import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import { execSync } from 'child_process'

const TARGET_JID = '919999887404@s.whatsapp.net'
const QR_IMAGE = './whatsapp-qr.png'
const MAX_MESSAGES = 10

const startConnection = async () => {
  console.log(`\n🚀 Fetching last ${MAX_MESSAGES} messages from ${TARGET_JID}\n`)

  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const { version } = await fetchLatestBaileysVersion()

  console.log(`📱 Using WA v${version.join('.')}\n`)

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: true,
  })

  sock.ev.on('creds.update', saveCreds)

  let collectedMessages: any[] = []
  let printed = false

  // Handle QR code
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📱 QR code received! Saving as image...')
      await QRCode.toFile(QR_IMAGE, qr, { width: 600 })
      console.log(`✅ QR saved to: ${QR_IMAGE}`)
      console.log('🔄 Opening QR code image...')
      try { execSync(`xdg-open ${QR_IMAGE}`) } catch { }
      console.log('\n👉 Scan with WhatsApp → Settings → Linked Devices → Link a Device\n')
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log('Reconnecting...')
        startConnection()
      } else {
        console.log('Logged out.')
        process.exit(0)
      }
    } else if (connection === 'open') {
      console.log('✅ Connected! Waiting for history sync...\n')
    }
  })

  // Collect history sync messages
  sock.ev.on('messaging-history.set', ({ messages }) => {
    const matched = messages.filter((msg: any) => msg.key.remoteJid === TARGET_JID)
    if (matched.length > 0) {
      collectedMessages.push(...matched)
      console.log(`📥 Batch received: ${matched.length} messages (total: ${collectedMessages.length})`)
    }
  })

  // Also catch real-time messages
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type === 'notify') {
      const matched = messages.filter((msg: any) => msg.key.remoteJid === TARGET_JID)
      if (matched.length > 0) {
        collectedMessages.push(...matched)
        console.log(`📩 Real-time: ${matched.length} new messages`)
      }
    }
  })

  const printResults = () => {
    if (printed) return
    printed = true

    // Sort by timestamp descending, take last N
    collectedMessages.sort((a, b) => {
      const tsA = typeof a.messageTimestamp === 'object' ? Number(a.messageTimestamp.low) : Number(a.messageTimestamp)
      const tsB = typeof b.messageTimestamp === 'object' ? Number(b.messageTimestamp.low) : Number(b.messageTimestamp)
      return tsA - tsB
    })

    const last10 = collectedMessages.slice(-MAX_MESSAGES)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 RESULTS: ${collectedMessages.length} total messages found`)
    console.log(`   Showing last ${last10.length}:`)
    console.log('='.repeat(60))

    last10.forEach((msg, i) => {
      const ts = typeof msg.messageTimestamp === 'object'
        ? Number(msg.messageTimestamp.low)
        : Number(msg.messageTimestamp)
      const date = new Date(ts * 1000).toLocaleString()
      const from = msg.key.fromMe ? 'You' : '9999887404'
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        `[${Object.keys(msg.message || {})[0] || 'unknown'}]`

      console.log(`\n${i + 1}. [${date}] ${from}:`)
      console.log(`   ${text.substring(0, 200)}`)
    })

    console.log(`\n✅ Done! Press Ctrl+C to exit.\n`)
  }

  // Print after 90 seconds of syncing
  setTimeout(printResults, 90_000)

  // Also print early if we already have enough
  const checkInterval = setInterval(() => {
    if (collectedMessages.length >= MAX_MESSAGES && !printed) {
      console.log(`\n✅ Got ${collectedMessages.length} messages, waiting 10 more seconds for stragglers...`)
      clearInterval(checkInterval)
      setTimeout(printResults, 10_000)
    }
  }, 5_000)
}

startConnection().catch(err => {
  console.error('Fatal Error:', err)
  process.exit(1)
})
