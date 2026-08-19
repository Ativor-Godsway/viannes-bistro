import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'customer' | 'admin' | 'staff';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  phone?: string;
  name: string;
  role: UserRole;
  savedAddresses: { zone: string; address: string; isDefault: boolean }[];
  isActive: boolean;
  comparePassword(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['customer', 'admin', 'staff'], default: 'customer' },
    savedAddresses: [
      { zone: String, address: String, isDefault: { type: Boolean, default: false } },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export const User = model<IUser>('User', userSchema);
