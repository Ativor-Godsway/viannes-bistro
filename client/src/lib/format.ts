/** Formats GHS. A null/undefined amount renders as nothing at all — an item
 *  without a price must never appear to have one. */
export const GHS = (n: number | null | undefined): string =>
  n == null
    ? ''
    : `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  ready: 'bg-purple-100 text-purple-800',
  out_for_delivery: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const UG_ZONES = [
  { name: 'Legon Hall', fee: 5 },
  { name: 'Commonwealth Hall', fee: 5 },
  { name: 'Akuafo Hall', fee: 5 },
  { name: 'Volta Hall', fee: 5 },
  { name: 'Pentagon Hostel', fee: 8 },
  { name: 'Evandy Hostel', fee: 8 },
  { name: 'TF Hostel', fee: 7 },
  { name: 'Bani Hostel', fee: 8 },
  { name: 'Main Campus / Departments', fee: 6 },
];
