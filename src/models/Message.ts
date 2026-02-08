import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type BelongsToGetAssociationMixin,
  type HasManyGetAssociationsMixin,
  type Sequelize,
} from 'sequelize';
import type { Chat } from './Chat.js';
import type { MessageMedia } from './MessageMedia.js';

class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<number>;
  declare message_id: string;
  declare chat_id: ForeignKey<number>;
  declare sender_id: string;
  declare sender_name: CreationOptional<string | null>;
  declare is_from_me: CreationOptional<boolean>;
  declare body: CreationOptional<string | null>;
  declare message_type: string;
  declare has_media: CreationOptional<boolean>;
  declare media_url: CreationOptional<string | null>;
  declare media_filename: CreationOptional<string | null>;
  declare media_mimetype: CreationOptional<string | null>;
  declare media_size: CreationOptional<number | null>;
  declare media_caption: CreationOptional<string | null>;
  declare thumbnail_url: CreationOptional<string | null>;
  declare timestamp: Date;
  declare is_forwarded: CreationOptional<boolean>;
  declare is_starred: CreationOptional<boolean>;
  declare is_deleted: CreationOptional<boolean>;
  declare quoted_message_id: ForeignKey<CreationOptional<number | null>>;
  declare status: CreationOptional<string | null>;
  declare mentions: CreationOptional<string[] | null>;
  declare reactions: CreationOptional<Record<string, unknown> | null>;
  declare poll_data: CreationOptional<Record<string, unknown> | null>;
  declare location_data: CreationOptional<Record<string, unknown> | null>;
  declare contact_data: CreationOptional<Record<string, unknown> | null>;
  declare raw_data: CreationOptional<Record<string, unknown> | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare chat?: NonAttribute<Chat>;
  declare media?: NonAttribute<MessageMedia[]>;
  declare quotedMessage?: NonAttribute<Message | null>;
  declare replies?: NonAttribute<Message[]>;
  declare getChat: BelongsToGetAssociationMixin<Chat>;
  declare getMedia: HasManyGetAssociationsMixin<MessageMedia>;
  declare getQuotedMessage: BelongsToGetAssociationMixin<Message>;
  declare getReplies: HasManyGetAssociationsMixin<Message>;

  static associate(models: {
    Chat: typeof Chat;
    MessageMedia: typeof MessageMedia;
    Message: typeof Message;
  }): void {
    Message.belongsTo(models.Chat, { foreignKey: 'chat_id', as: 'chat' });
    Message.hasMany(models.MessageMedia, { foreignKey: 'message_id', as: 'media' });
    Message.belongsTo(models.Message, { foreignKey: 'quoted_message_id', as: 'quotedMessage' });
    Message.hasMany(models.Message, { foreignKey: 'quoted_message_id', as: 'replies' });
  }

  static initModel(sequelize: Sequelize): typeof Message {
    Message.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        message_id: { type: DataTypes.STRING(255), unique: true, allowNull: false },
        chat_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'chats', key: 'id' },
          onDelete: 'CASCADE',
        },
        sender_id: { type: DataTypes.STRING(100), allowNull: false },
        sender_name: { type: DataTypes.STRING(255), allowNull: true },
        is_from_me: { type: DataTypes.BOOLEAN, defaultValue: false },
        body: { type: DataTypes.TEXT, allowNull: true },
        message_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: [[
              'chat', 'image', 'video', 'audio', 'document', 'sticker',
              'ptt', 'location', 'contact', 'poll', 'system', 'reaction',
              'protocol', 'revoke', 'unknown',
            ]],
          },
        },
        has_media: { type: DataTypes.BOOLEAN, defaultValue: false },
        media_url: { type: DataTypes.TEXT, allowNull: true },
        media_filename: { type: DataTypes.STRING(500), allowNull: true },
        media_mimetype: { type: DataTypes.STRING(100), allowNull: true },
        media_size: { type: DataTypes.BIGINT, allowNull: true },
        media_caption: { type: DataTypes.TEXT, allowNull: true },
        thumbnail_url: { type: DataTypes.TEXT, allowNull: true },
        timestamp: { type: DataTypes.DATE, allowNull: false },
        is_forwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_starred: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
        quoted_message_id: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'messages', key: 'id' },
          onDelete: 'SET NULL',
        },
        status: { type: DataTypes.STRING(20), allowNull: true },
        mentions: { type: DataTypes.JSONB, allowNull: true },
        reactions: { type: DataTypes.JSONB, allowNull: true },
        poll_data: { type: DataTypes.JSONB, allowNull: true },
        location_data: { type: DataTypes.JSONB, allowNull: true },
        contact_data: { type: DataTypes.JSONB, allowNull: true },
        raw_data: { type: DataTypes.JSONB, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'messages',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return Message;
  }
}

export { Message };
export default Message;
