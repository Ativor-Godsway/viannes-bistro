import { Schema, model, Types } from 'mongoose';
import { modifierOptionSchema, IModifierOption, ModifierGroupType } from './MenuItem';

/**
 * A reusable modifier group — "Drinks add-on", "Spice level" — defined once and
 * attached to many items.
 *
 * Attaching copies the shape onto the item and records `templateId`, so the
 * item keeps working if the template is later deleted, while an un-overridden
 * copy can still be refreshed from the template on demand. Admin editing an
 * attached group in place sets `overridden` and it stops tracking.
 */
export interface IModifierGroupTemplate {
  name: string;
  type: ModifierGroupType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: IModifierOption[];
  /** Ids of MenuItems this template is attached to, for the library page count. */
  usageCount?: number;
}

const templateSchema = new Schema<IModifierGroupTemplate>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: ['single', 'multi'], default: 'single' },
    required: { type: Boolean, default: false },
    minSelect: { type: Number, default: 0, min: 0 },
    maxSelect: { type: Number, default: 0, min: 0 },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { timestamps: true }
);

export type ModifierGroupTemplateDoc = IModifierGroupTemplate & {
  _id: Types.ObjectId;
};

export const ModifierGroupTemplate = model<IModifierGroupTemplate>(
  'ModifierGroupTemplate',
  templateSchema
);
