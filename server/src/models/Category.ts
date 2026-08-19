import { Schema, model, Document } from 'mongoose';

export interface ICategory extends Document {
  /** Stable catalogue identity — see MenuItem.slug. */
  slug?: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
}

const categorySchema = new Schema<ICategory>(
  {
    slug: { type: String, trim: true, index: { unique: true, sparse: true } },
    name: { type: String, required: true, unique: true, trim: true },
    description: String,
    icon: String,
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Category = model<ICategory>('Category', categorySchema);
