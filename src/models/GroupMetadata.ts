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
import type { GroupParticipant } from './GroupParticipant.js';

class GroupMetadata extends Model<InferAttributes<GroupMetadata>, InferCreationAttributes<GroupMetadata>> {
  declare id: CreationOptional<number>;
  declare chat_id: ForeignKey<number>;
  declare subject: CreationOptional<string | null>;
  declare subject_owner: CreationOptional<string | null>;
  declare subject_time: CreationOptional<Date | null>;
  declare owner: CreationOptional<string | null>;
  declare creation_time: CreationOptional<Date | null>;
  declare community_id: CreationOptional<string | null>;
  declare is_community: CreationOptional<boolean>;
  declare is_community_announce: CreationOptional<boolean>;
  declare announce: CreationOptional<boolean>;
  declare restrict_mode: CreationOptional<boolean>;
  declare join_approval_mode: CreationOptional<boolean>;
  declare member_add_mode: CreationOptional<boolean>;
  declare description: CreationOptional<string | null>;
  declare description_id: CreationOptional<string | null>;
  declare ephemeral_duration: CreationOptional<number | null>;
  declare invite_code: CreationOptional<string | null>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare chat?: NonAttribute<Chat>;
  declare participants?: NonAttribute<GroupParticipant[]>;
  declare getChat: BelongsToGetAssociationMixin<Chat>;
  declare getParticipants: HasManyGetAssociationsMixin<GroupParticipant>;

  static associate(models: {
    Chat: typeof Chat;
    GroupParticipant: typeof GroupParticipant;
  }): void {
    GroupMetadata.belongsTo(models.Chat, { foreignKey: 'chat_id', as: 'chat' });
    GroupMetadata.hasMany(models.GroupParticipant, { foreignKey: 'group_metadata_id', as: 'participants' });
  }

  static initModel(sequelize: Sequelize): typeof GroupMetadata {
    GroupMetadata.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        chat_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          unique: true,
          references: { model: 'chats', key: 'id' },
          onDelete: 'CASCADE',
        },
        subject: { type: DataTypes.STRING(255), allowNull: true },
        subject_owner: { type: DataTypes.STRING(100), allowNull: true },
        subject_time: { type: DataTypes.DATE, allowNull: true },
        owner: { type: DataTypes.STRING(100), allowNull: true },
        creation_time: { type: DataTypes.DATE, allowNull: true },
        community_id: { type: DataTypes.STRING(255), allowNull: true },
        is_community: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_community_announce: { type: DataTypes.BOOLEAN, defaultValue: false },
        announce: { type: DataTypes.BOOLEAN, defaultValue: false },
        restrict_mode: { type: DataTypes.BOOLEAN, defaultValue: false },
        join_approval_mode: { type: DataTypes.BOOLEAN, defaultValue: false },
        member_add_mode: { type: DataTypes.BOOLEAN, defaultValue: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        description_id: { type: DataTypes.STRING(255), allowNull: true },
        ephemeral_duration: { type: DataTypes.INTEGER, allowNull: true },
        invite_code: { type: DataTypes.STRING(255), allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'group_metadata',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return GroupMetadata;
  }
}

export { GroupMetadata };
export default GroupMetadata;
