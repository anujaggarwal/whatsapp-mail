import { Contact } from '../models/index.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('contact-handler');

interface ContactUpdate {
  id: string;
  name?: string | null;
  notify?: string | null;
  imgUrl?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

class ContactHandler {
  /**
   * Handles contacts.update events from Baileys.
   * Upserts contact records with the latest name, avatar, and about info.
   */
  static async handleUpdate(updates: ContactUpdate[]): Promise<void> {
    log.info({ count: updates.length }, 'Processing contact updates');

    for (const update of updates) {
      try {
        if (!update.id) {
          log.warn('Skipping contact update with missing id');
          continue;
        }

        const contactName = update.name || update.notify || null;

        const [contact, created] = await Contact.findOrCreate({
          where: { contact_id: update.id },
          defaults: {
            contact_id: update.id,
            name: contactName,
            avatar_url: update.imgUrl || null,
            about: update.status || null,
          },
        });

        if (!created) {
          // Update existing contact with new data
          const changes: Record<string, unknown> = {};

          if (contactName !== null && contactName !== undefined) {
            changes.name = contactName;
          }

          if (update.imgUrl !== undefined) {
            changes.avatar_url = update.imgUrl;
          }

          if (update.status !== undefined) {
            changes.about = update.status;
          }

          if (Object.keys(changes).length > 0) {
            changes.last_seen_at = new Date();
            await contact.update(changes);
            log.info(
              { contactId: update.id, changes: Object.keys(changes) },
              'Contact updated'
            );
          }
        } else {
          log.info({ contactId: update.id }, 'Contact created');
        }
      } catch (err) {
        log.error({ err, contactId: update.id }, 'Failed to process contact update');
      }
    }
  }
}

export { ContactHandler };
export default ContactHandler;
