import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type NonAttribute,
  type HasManyGetAssociationsMixin,
  type HasOneGetAssociationMixin,
  type Sequelize,
} from 'sequelize';
import type { Message } from './Message.js';
import type { GroupMetadata } from './GroupMetadata.js';

class Chat extends Model<InferAttributes<Chat>, InferCreationAttributes<Chat>> {
  declare id: CreationOptional<number>;
  declare chat_id: string;
  declare chat_type: 'private' | 'group' | 'broadcast';
  declare name: CreationOptional<string | null>;
  declare avatar_url: CreationOptional<string | null>;
  declare description: CreationOptional<string | null>;
  declare is_archived: CreationOptional<boolean>;
  declare is_pinned: CreationOptional<boolean>;
  declare is_muted: CreationOptional<boolean>;
  declare last_message_at: CreationOptional<Date | null>;
  declare last_message_preview: CreationOptional<string | null>;
  declare unread_count: CreationOptional<number>;
  declare total_message_count: CreationOptional<number>;
  declare participant_count: CreationOptional<number | null>;
  declare is_read_only: CreationOptional<boolean>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare messages?: NonAttribute<Message[]>;
  declare groupMetadata?: NonAttribute<GroupMetadata>;
  declare getMessages: HasManyGetAssociationsMixin<Message>;
  declare getGroupMetadata: HasOneGetAssociationMixin<GroupMetadata>;

  static associate(models: {
    Message: typeof Message;
    GroupMetadata: typeof GroupMetadata;
  }): void {
    Chat.hasMany(models.Message, { foreignKey: 'chat_id', as: 'messages' });
    Chat.hasOne(models.GroupMetadata, { foreignKey: 'chat_id', as: 'groupMetadata' });
  }

  static initModel(sequelize: Sequelize): typeof Chat {
    Chat.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        chat_id: { type: DataTypes.STRING(255), unique: true, allowNull: false },
        chat_type: {
          type: DataTypes.STRING(20),
          allowNull: false,
          validate: { isIn: [['private', 'group', 'broadcast']] },
        },
        name: { type: DataTypes.STRING(255), allowNull: true },
        avatar_url: { type: DataTypes.TEXT, allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        is_archived: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_muted: { type: DataTypes.BOOLEAN, defaultValue: false },
        last_message_at: { type: DataTypes.DATE, allowNull: true },
        last_message_preview: { type: DataTypes.TEXT, allowNull: true },
        unread_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        total_message_count: { type: DataTypes.BIGINT, defaultValue: 0 },
        participant_count: { type: DataTypes.INTEGER, allowNull: true },
        is_read_only: { type: DataTypes.BOOLEAN, defaultValue: false },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'chats',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return Chat;
  }
}

export { Chat };
export default Chat;
