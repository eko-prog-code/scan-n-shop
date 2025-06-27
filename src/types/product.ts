export interface Product {
  barcode: string;
  id: string;
  image: string;
  name: string;
  regularPrice: number; // atau ganti ke 'price' agar konsisten
  stock: number;
  quantity?: number;
  createdAt?: string; // tambahan untuk timestamp
}
