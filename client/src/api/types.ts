// Shapes of the JSON the API returns. They mirror the server's service types.

export type Role = 'customer' | 'studio';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Painting {
  id: string;
  title: string;
  artist: string;
  description: string;
  price: number;
  imageUrl: string | null;
  status: 'available' | 'sold';
}

export interface Order {
  id: number;
  paintingId: string;
  paintingTitle: string;
  customerName: string;
  customerEmail: string;
  price: number;
  status: 'placed' | 'cancelled';
  createdAt: string;
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled';

export interface Booking {
  id: number;
  customerName: string;
  customerEmail: string;
  date: string;
  wallSizeSqft: number;
  address: string;
  ratePerSqft: number;
  price: number;
  status: BookingStatus;
  createdAt: string;
}

export type PotteryStatus = 'requested' | 'accepted' | 'declined' | 'cancelled';

export interface PotteryRequest {
  id: number;
  customerName: string;
  customerEmail: string;
  itemId: string;
  itemName: string;
  glazeId: string;
  glazeName: string;
  quantity: number;
  neededBy: string;
  status: PotteryStatus;
  createdAt: string;
}

export interface Option {
  id: string;
  name: string;
}

export interface StudioInfo {
  currency: string;
  muralRatePerSqFt: number;
  today: string;
  booking: {
    minWallSqft: number;
    maxWallSqft: number;
    earliestDate: string;
    latestDate: string;
    cancelUntilDaysBefore: number;
  };
  pottery: { minQuantity: number; maxQuantity: number; earliestNeededBy: string };
}
