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
import type { GroupMetadata } from './GroupMetadata.js';

class GroupParticipant extends Model<InferAttributes<GroupParticipant>, InferCreationAttributes<GroupParticipant>> {
  declare id: CreationOptional<number>;
  declare group_metadata_id: ForeignKey<number>;
  declare participant_jid: string;
  declare role: CreationOptional<'member' | 'admin' | 'super_admin'>;
  declare is_active: CreationOptional<boolean>;
  declare added_at: CreationOptional<Date>;
  declare removed_at: CreationOptional<Date | null>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare groupMetadata?: NonAttribute<GroupMetadata>;
  declare getGroupMetadata: BelongsToGetAssociationMixin<GroupMetadata>;

  static associate(models: { GroupMetadata: typeof GroupMetadata }): void {
    GroupParticipant.belongsTo(models.GroupMetadata, { foreignKey: 'group_metadata_id', as: 'groupMetadata' });
  }

  static initModel(sequelize: Sequelize): typeof GroupParticipant {
    GroupParticipant.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        group_metadata_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'group_metadata', key: 'id' },
          onDelete: 'CASCADE',
        },
        participant_jid: { type: DataTypes.STRING(100), allowNull: false },
        role: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'member',
          validate: { isIn: [['member', 'admin', 'super_admin']] },
        },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
        added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        removed_at: { type: DataTypes.DATE, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'group_participants',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return GroupParticipant;
  }
}

export { GroupParticipant };
export default GroupParticipant;
