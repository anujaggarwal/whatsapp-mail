import { Chat, GroupMetadata, GroupParticipant } from '../models/index.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('group-handler');

interface GroupUpdate {
  id: string;
  subject?: string;
  owner?: string;
  desc?: string;
  announce?: boolean;
  restrict?: boolean;
  joinApprovalMode?: boolean;
  memberAddMode?: boolean;
  ephemeralDuration?: number;
  [key: string]: unknown;
}

interface ParticipantsUpdateEvent {
  id: string;
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote';
}

class GroupHandler {
  /**
   * Handles groups.update events from Baileys.
   * Updates group metadata (subject, description, announce mode, etc.).
   */
  static async handleGroupUpdate(updates: GroupUpdate[]): Promise<void> {
    log.info({ count: updates.length }, 'Processing group updates');

    for (const update of updates) {
      try {
        if (!update.id) {
          log.warn('Skipping group update with missing id');
          continue;
        }

        // Find the chat record
        const chat = await Chat.findOne({ where: { chat_id: update.id } });
        if (!chat) {
          log.debug(
            { groupId: update.id },
            'Chat not found for group update, skipping'
          );
          continue;
        }

        // Build the update payload, only including present fields
        const changes: Record<string, unknown> = {};

        if (update.subject !== undefined) {
          changes.subject = update.subject;
          // Also update the chat name
          await chat.update({ name: update.subject });
        }

        if (update.owner !== undefined) {
          changes.owner = update.owner;
        }

        if (update.desc !== undefined) {
          changes.description = update.desc;
        }

        if (update.announce !== undefined) {
          changes.announce = update.announce;
        }

        if (update.restrict !== undefined) {
          changes.restrict_mode = update.restrict;
        }

        if (update.joinApprovalMode !== undefined) {
          changes.join_approval_mode = update.joinApprovalMode;
        }

        if (update.memberAddMode !== undefined) {
          changes.member_add_mode = update.memberAddMode;
        }

        if (update.ephemeralDuration !== undefined) {
          changes.ephemeral_duration = update.ephemeralDuration;
        }

        if (Object.keys(changes).length > 0) {
          // Upsert group metadata
          const [groupMeta, created] = await GroupMetadata.findOrCreate({
            where: { chat_id: chat.id },
            defaults: {
              chat_id: chat.id,
              ...changes,
            } as Record<string, unknown> & { chat_id: number },
          });

          if (!created) {
            await groupMeta.update(changes);
          }

          log.info(
            { groupId: update.id, changes: Object.keys(changes), created },
            'Group metadata updated'
          );
        }
      } catch (err) {
        log.error({ err, groupId: update.id }, 'Failed to process group update');
      }
    }
  }

  /**
   * Handles group-participants.update events from Baileys.
   * Manages participant additions, removals, promotions, and demotions.
   */
  static async handleParticipantsUpdate(
    event: ParticipantsUpdateEvent
  ): Promise<void> {
    const { id: groupJid, participants, action } = event;

    log.info(
      { groupJid, action, participantCount: participants.length },
      'Processing group participants update'
    );

    try {
      // Find the chat and group metadata
      const chat = await Chat.findOne({ where: { chat_id: groupJid } });
      if (!chat) {
        log.debug(
          { groupJid },
          'Chat not found for participants update, skipping'
        );
        return;
      }

      // Ensure group metadata exists
      const [groupMeta] = await GroupMetadata.findOrCreate({
        where: { chat_id: chat.id },
        defaults: { chat_id: chat.id },
      });

      for (const participantJid of participants) {
        try {
          switch (action) {
            case 'add': {
              await GroupParticipant.findOrCreate({
                where: {
                  group_metadata_id: groupMeta.id,
                  participant_jid: participantJid,
                },
                defaults: {
                  group_metadata_id: groupMeta.id,
                  participant_jid: participantJid,
                  role: 'member',
                  is_active: true,
                  added_at: new Date(),
                },
              });
              log.info(
                { groupJid, participantJid },
                'Participant added to group'
              );
              break;
            }

            case 'remove': {
              const participant = await GroupParticipant.findOne({
                where: {
                  group_metadata_id: groupMeta.id,
                  participant_jid: participantJid,
                },
              });
              if (participant) {
                await participant.update({
                  is_active: false,
                  removed_at: new Date(),
                });
                log.info(
                  { groupJid, participantJid },
                  'Participant removed from group'
                );
              }
              break;
            }

            case 'promote': {
              const toPromote = await GroupParticipant.findOne({
                where: {
                  group_metadata_id: groupMeta.id,
                  participant_jid: participantJid,
                },
              });
              if (toPromote) {
                await toPromote.update({ role: 'admin' });
                log.info(
                  { groupJid, participantJid },
                  'Participant promoted to admin'
                );
              }
              break;
            }

            case 'demote': {
              const toDemote = await GroupParticipant.findOne({
                where: {
                  group_metadata_id: groupMeta.id,
                  participant_jid: participantJid,
                },
              });
              if (toDemote) {
                await toDemote.update({ role: 'member' });
                log.info(
                  { groupJid, participantJid },
                  'Participant demoted to member'
                );
              }
              break;
            }

            default:
              log.warn({ action, groupJid, participantJid }, 'Unknown participant action');
          }
        } catch (err) {
          log.error(
            { err, groupJid, participantJid, action },
            'Failed to process participant update'
          );
        }
      }
    } catch (err) {
      log.error({ err, groupJid, action }, 'Failed to process group participants update');
    }
  }
}

export { GroupHandler };
export default GroupHandler;
