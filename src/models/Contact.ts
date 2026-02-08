import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type Sequelize,
} from 'sequelize';

class Contact extends Model<InferAttributes<Contact>, InferCreationAttributes<Contact>> {
  declare id: CreationOptional<number>;
  declare contact_id: string;
  declare phone_number: CreationOptional<string | null>;
  declare name: CreationOptional<string | null>;
  declare nickname: CreationOptional<string | null>;
  declare about: CreationOptional<string | null>;
  declare avatar_url: CreationOptional<string | null>;
  declare is_business: CreationOptional<boolean>;
  declare is_enterprise: CreationOptional<boolean>;
  declare business_profile: CreationOptional<Record<string, unknown> | null>;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare first_seen_at: CreationOptional<Date>;
  declare last_seen_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static associate(_models: Record<string, unknown>): void {
    // Contact has no direct associations in current schema
  }

  static initModel(sequelize: Sequelize): typeof Contact {
    Contact.init(
      {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        contact_id: { type: DataTypes.STRING(100), unique: true, allowNull: false },
        phone_number: { type: DataTypes.STRING(20), allowNull: true },
        name: { type: DataTypes.STRING(255), allowNull: true },
        nickname: { type: DataTypes.STRING(255), allowNull: true },
        about: { type: DataTypes.TEXT, allowNull: true },
        avatar_url: { type: DataTypes.TEXT, allowNull: true },
        is_business: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_enterprise: { type: DataTypes.BOOLEAN, defaultValue: false },
        business_profile: { type: DataTypes.JSONB, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: true },
        first_seen_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        last_seen_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'contacts',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return Contact;
  }
}

export { Contact };
export default Contact;
