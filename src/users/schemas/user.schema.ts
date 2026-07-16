import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

// --------------------
// Sheet Configuration
// --------------------
@Schema({ _id: false })
export class SheetConfiguration {
  @Prop({ default: null })
  id!: string;

  @Prop({ default: null })
  sheetTabName!: string;

  @Prop({ default: null })
  taskNameIndex!: number;

  @Prop({ default: null })
  durationIndex!: number;

  @Prop({ default: null })
  statusIndex!: number;

  @Prop({ default: null })
  dateIndex!: number;

  @Prop({ default: null })
  projectIndex!: number;
}

export const SheetConfigurationSchema =
  SchemaFactory.createForClass(SheetConfiguration);
@Schema({ _id: false })
export class RecipientConfigurations {
  @Prop({ default: [] })
  eodMailTo!: string[];

  @Prop({ default: [] })
  eodMailCc!: string[];

  @Prop({ default: [] })
  eodMailBcc!: string[];
}

export const RecipientConfigurationsSchema = SchemaFactory.createForClass(
  RecipientConfigurations,
);

// --------------------
// User Configuration
// --------------------

@Schema({ _id: false })
export class Portal {
  @Prop({ type: String })
  id!: string;

  @Prop()
  name!: string;
}

export const PortalSchema = SchemaFactory.createForClass(Portal);

@Schema({ _id: false })
export class UserConfiguration {
  @Prop({ default: false })
  validatedGoogle!: boolean;

  @Prop({ default: null })
  googleRefreshToken!: string;

  @Prop({ default: false })
  validatedZoho!: boolean;

  @Prop({ default: null })
  zohoRefreshToken!: string;

  @Prop({ default: "EOD" })
  cronOption!: string;

  @Prop({ type: PortalSchema, default: null })
  portal!: Portal | null;

  @Prop({ default: null })
  zohoUserId!: string;

  @Prop({
    type: [PortalSchema],
    default: [],
  })
  projects!: Portal[];

  @Prop({ type: PortalSchema, default: null })
  defaultProject!: Portal | null;

  @Prop({ type: SheetConfigurationSchema, default: null })
  sheet!: SheetConfiguration | null;

  @Prop({ type: RecipientConfigurationsSchema, default: null })
  recipient!: RecipientConfigurations | null;

  @Prop({ default: null })
  jobFailureTriggerRecipient!: string;

  @Prop({ default: false })
  triggerCron!: boolean;
}

export const UserConfigurationSchema =
  SchemaFactory.createForClass(UserConfiguration);

// --------------------
// Main User Schema
// --------------------
export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({ default: null })
  userProfileUrl!: string;

  @Prop({
    type: UserConfigurationSchema,
    default: () => ({}),
  })
  configuration!: UserConfiguration;
}

export const UserSchema = SchemaFactory.createForClass(User);
