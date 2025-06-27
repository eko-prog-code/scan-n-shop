import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface Product {
  id: string;
  barcode: string;
  name: string;
  regularPrice: number;
  price?: number; // Tambahkan ini untuk kompatibilitas
  image?: string;
  stock?: number;
}

interface CartItem extends Product {
  quantity: number;
  addedAt: string;
}

const Scanner = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{
    barcode: string;
    status: "success" | "error";
    message: string;
  } | null>(null);

  const handleScan = async (decodedText: string) => {
    try {
      // 1) Ambil data produk dari Firebase
      const prodSnap = await get(ref(db, "products"));
      const products = prodSnap.val() as Record<string, Product> || {};

      // 2) Cari produk berdasarkan barcode
      const foundProductEntry = Object.entries(products).find(
        ([, product]) => product.barcode === decodedText
      );

      if (!foundProductEntry) {
        throw new Error("Produk tidak ditemukan");
      }

      const [productId, productData] = foundProductEntry;

      // 3) Validasi data produk
      const sellingPrice = productData.price || productData.regularPrice;
      
      if (typeof sellingPrice !== "number" || sellingPrice <= 0) {
        throw new Error("Harga produk tidak valid");
      }

      // 4) Update keranjang belanja
      const cartRef = ref(db, "cart/global/items");
      const transactionResult = await runTransaction(cartRef, (currentCart) => {
        const cartItems = currentCart as Record<string, CartItem> || {};

        // Cek jika produk sudah ada di keranjang
        const existingItemKey = Object.keys(cartItems).find(
          (key) => cartItems[key].id === productId
        );

        if (existingItemKey) {
          return undefined; // Batalkan jika produk sudah ada
        }

        // Generate key baru
        const numericKeys = Object.keys(cartItems)
          .map(Number)
          .filter((n) => !isNaN(n));
        const newKey = numericKeys.length > 0 ? Math.max(...numericKeys) + 1 : 0;

        // Tambahkan item baru
        return {
          ...cartItems,
          [newKey]: {
            ...productData,
            id: productId,
            quantity: 1,
            price: sellingPrice, // Gunakan harga yang sudah divalidasi
            addedAt: new Date().toISOString(),
          },
        };
      });

      if (transactionResult.committed) {
        toast.success(`${productData.name} ditambahkan ke keranjang`);
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: productData.name,
        });
        new Audio("/audio.mp3").play().catch(() => {});
      } else {
        throw new Error("Produk sudah ada di keranjang");
      }
    } catch (error) {
      console.error("Error scanning:", error);
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
      
      toast.error(errorMessage);
      setLastScan({
        barcode: decodedText,
        status: "error",
        message: errorMessage,
      });
    }
  };

  // ... (kode untuk startScanner, stopScanner, dan useEffect tetap sama)

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="rounded-lg overflow-hidden shadow-lg bg-white">
        <div id="reader" className="w-full aspect-square" />

        {!isScanning && (
          <div className="p-4 text-center">
            <p className="text-gray-600 mb-2">Kamera tidak aktif</p>
            <button
              onClick={startScanner}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Aktifkan Scanner
            </button>
          </div>
        )}

        {lastScan && (
          <div className={`p-4 border-t ${
            lastScan.status === "success" 
              ? "bg-green-100 text-green-800" 
              : "bg-red-100 text-red-800"
          }`}>
            <div className="font-medium">Barcode: {lastScan.barcode}</div>
            <div className="mt-1">{lastScan.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
