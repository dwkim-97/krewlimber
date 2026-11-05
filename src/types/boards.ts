export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface NoticeSummary {
  id: string;
  title: string;
  pinned: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
  views: number;
}
export interface Notice extends NoticeSummary {
  body: string;
}
export type ProductCategory = 'gear' | 'apparel' | 'voucher' | 'other';
export interface ProductInput {
  name: string;
  description: string;
  imageUrl: string | null;
  category: ProductCategory;
  points: number;
  stock: number;
  active: boolean;
}
export interface Product extends ProductInput {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface PointEntry {
  id: number;
  amount: number;
  reason: string;
  actor: string;
  createdAt: string;
}
export interface Wallet {
  balance: number;
  entries: PointEntry[];
}
export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export interface MarketOrder {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  points: number;
  quantity: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
