import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type BelongsToGetAssociationMixin,
  type Sequelize,
} from 'sequelize';
import type { Message } from './Message.js';

class MessageMedia extends Model<InferAttributes<MessageMedia>, InferCreationAttributes<MessageMedia>> {
  declare id: CreationOptional<number>;
  declare message_id: ForeignKey<number>;
  declare storage_provider: CreationOptional<string>;
  declare storage_key: string;
  declare storage_url: CreationOptional<string | null>;
  declare filename: CreationOptional<string | null>;
  declare mimetype: CreationOptional<string | null>;
  declare size_bytes: CreationOptional<number | null>;
  declare duration_seconds: CreationOptional<number | null>;
  declare width: CreationOptional<number | null>;
  declare height: CreationOptional<number | null>;
  declare is_processed: CreationOptional<boolean>;
  declare thumbnail_url: CreationOptional<string | null>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare message?: NonAttribute<Message>;
  declare getMessage: BelongsToGetAssociationMixin<Message>;

  static associate(models: { Message: typeof Message }): void {
    MessageMedia.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
  }

  static initModel(sequelize: Sequelize): typeof MessageMedia {
    MessageMedia.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        message_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'messages', key: 'id' },
          onDelete: 'CASCADE',
        },
        storage_provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 's3' },
        storage_key: { type: DataTypes.TEXT, allowNull: false },
        storage_url: { type: DataTypes.TEXT, allowNull: true },
        filename: { type: DataTypes.STRING(500), allowNull: true },
        mimetype: { type: DataTypes.STRING(100), allowNull: true },
        size_bytes: { type: DataTypes.BIGINT, allowNull: true },
        duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
        width: { type: DataTypes.INTEGER, allowNull: true },
        height: { type: DataTypes.INTEGER, allowNull: true },
        is_processed: { type: DataTypes.BOOLEAN, defaultValue: false },
        thumbnail_url: { type: DataTypes.TEXT, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'message_media',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return MessageMedia;
  }
}

export { MessageMedia };
export default MessageMedia;
