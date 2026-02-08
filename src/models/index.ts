import sequelize from '../config/database.js';
import { Chat } from './Chat.js';
import { Message } from './Message.js';
import { Contact } from './Contact.js';
import { MessageMedia } from './MessageMedia.js';
import { GroupMetadata } from './GroupMetadata.js';
import { GroupParticipant } from './GroupParticipant.js';

// Initialize all models
Chat.initModel(sequelize);
Message.initModel(sequelize);
Contact.initModel(sequelize);
MessageMedia.initModel(sequelize);
GroupMetadata.initModel(sequelize);
GroupParticipant.initModel(sequelize);

// Set up associations
const models = { Chat, Message, Contact, MessageMedia, GroupMetadata, GroupParticipant };

Chat.associate({ Message, GroupMetadata });
Message.associate({ Chat, MessageMedia, Message });
Contact.associate(models);
MessageMedia.associate({ Message });
GroupMetadata.associate({ Chat, GroupParticipant });
GroupParticipant.associate({ GroupMetadata });

export { sequelize, Chat, Message, Contact, MessageMedia, GroupMetadata, GroupParticipant };
export default sequelize;
