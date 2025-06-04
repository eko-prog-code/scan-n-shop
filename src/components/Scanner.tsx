import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import type { Product } from "@/types/product";

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
      // 1) Cari produk berdasarkan barcode di node /products
      const productRef = ref(db, `products`);
      const snapshot = await get(productRef);
      const products = (snapshot.val() as Record<string, Product>) || {};

      const foundProduct = Object.values(products).find(
        (product) => product.barcode === decodedText
      );

      if (!foundProduct) {
        toast.error("Produk tidak ditemukan");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Produk tidak ditemukan di database",
        });
        return;
      }

      // 2) Cek stok dulu
      if (foundProduct.stock <= 0) {
        toast.error("Stok produk habis");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Stok produk habis",
        });
        return;
      }

      // 3) Kurangi stok produk (opsional, jika Anda ingin stok berkurang setelah scan)
      //    Misalnya:
      await update(ref(db, `products/${foundProduct.id}`), {
        stock: foundProduct.stock - 1,
      });

      // 4) Tambahkan ke cart dengan property `price` eksplisit
      const CART_ID = "global";
      // Gunakan product.id sebagai key, jangan gunakan barcode sebagai key di cart
      // supaya konsisten dengan Index.tsx yang memakai product.id
      const itemRef = ref(db, `cart/${CART_ID}/items/${foundProduct.id}`);

      const transactionResult = await runTransaction(itemRef, (currentData) => {
        if (currentData !== null) {
          // Jika item sudah ada di cart, maka batalkan transaksi (dibatalkan semata-mata karena 
          // di contoh Anda tidak meningkatkan quantity lewat scan; jika mau menambah quantity, 
          // Anda bisa mengembalikan objek dengan quantity + 1)
          return;
        }

        // Jika item belum ada di cart, tambahkan dengan struktur:
        return {
          id: foundProduct.id,
          name: foundProduct.name,
          barcode: foundProduct.barcode,
          price: Number(foundProduct.regularPrice), // ← PENTING: kirim field price
          quantity: 1,
          total: Number(foundProduct.regularPrice) * 1, // (optional, sesuai Index.tsx)
        };
      });

      if (!transactionResult.committed) {
        toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundProduct.name}" sudah ada di cart`,
        });
      } else {
        toast.success(
          `Produk "${foundProduct.name}" berhasil ditambahkan ke cart`
        );
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Produk ditambahkan: ${foundProduct.name}`,
        });

        // (Opsional) Putar suara notifikasi
        const audio = new Audio("/audio.mp3");
        audio.play().catch((err) => {
          console.error("Error memutar audio:", err);
        });
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat memproses scan");
      console.error("Scan error:", error);
      setLastScan({
        barcode: decodedText,
        status: "error",
        message: "Terjadi kesalahan saat memproses scan",
      });
    }
  };

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        (errorMessage: string) => {
          console.log("QR Error:", errorMessage);
        }
      );
      setIsScanning(true);
      setLastScan(null);
    } catch (err) {
      console.error("Gagal memulai scanner:", err);
      toast.error("Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Error menghentikan scanner:", err);
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current
          .stop()
          .catch(() => {
            // sudah tidak aktif, abaikan
          })
          .finally(() => {
            setIsScanning(false);
            scannerRef.current = null;
          });
      }
    };
  }, []);

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
              Mulai Scanner
            </button>
          </div>
        )}
        {lastScan && (
          <div
            className={`p-4 border-t ${
              lastScan.status === "success" ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <p className="font-medium mb-1">Hasil Scan Terakhir:</p>
            <p className="text-sm text-gray-600">
              Barcode: {lastScan.barcode}
            </p>
            <p
              className={`text-sm ${
                lastScan.status === "success"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {lastScan.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
