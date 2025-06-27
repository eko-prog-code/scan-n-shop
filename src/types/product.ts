export interface Product {
  barcode: string;
  id: string;
  image: string;
  name: string;
  regularPrice: number;
  stock: number;
  quantity?: number;
}

export interface CartItem extends Product {
  quantity: number;
  addedAt: string; // Waktu penambahan ke cart (ISO string)
}
