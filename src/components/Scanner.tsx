import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  ref,
  get,
  runTransaction,
  update,
  serverTimestamp,
} from "firebase/database";
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
      // 1) Cari produk berdasarkan barcode di /products
      const prodSnap = await get(ref(db, "products"));
      const products = (prodSnap.val() as Record<string, Product>) || {};
      const entries = Object.entries(products);
      const foundEntry = entries.find(
        ([, p]) => p.barcode === decodedText
      );
      if (!foundEntry) {
        toast.error("Produk tidak ditemukan di database");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Produk tidak ditemukan di database",
        });
        return;
      }
      const [productId, foundProduct] = foundEntry;

      // 2) Transaksi pada /cart/global/items
      const itemsRef = ref(db, "cart/global/items");
      const transactionResult = await runTransaction(itemsRef, (currentData) => {
        // currentData = null (belum ada item sama sekali) atau Object { "0": {...}, "1": {...}, ... }
        const itemsObj = (currentData as Record<string, any>) || {};

        // 2.a) Cek duplikat berdasarkan `id`
        for (const [key, itemObj] of Object.entries(itemsObj)) {
          if ((itemObj as any).id === productId) {
            // Jika sudah ada, batalkan transaksi (return undefined)
            return undefined;
          }
        }

        // 2.b) Hitung nextIndex secara berurutan
        const numericKeys = Object.keys(itemsObj)
          .map((k) => {
            const n = parseInt(k, 10);
            return isNaN(n) ? -1 : n;
          })
          .filter((n) => n >= 0);

        const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : -1;
        const nextIndex = maxKey + 1; // misal, jika keys=[0,1], nextIndex=2

        // 2.c) Tambahkan item baru di index ini
        itemsObj[nextIndex.toString()] = {
          id: productId,
          name: foundProduct.name,
          barcode: foundProduct.barcode,
          price: Number(foundProduct.regularPrice),
          quantity: 1,
          createdAt: new Date().toISOString(), // atau serverTimestamp()
        };

        // Return objek baru (seluruh `itemsObj`) agar Firebase tulis kembali
        return itemsObj;
      });

      if (!transactionResult.committed) {
        // Jika runTransaction tidak committed, berarti duplikat ditemukan
        toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundProduct.name}" sudah ada di cart`,
        });
      } else {
        // Berhasil ditambahkan (commit)
        toast.success(`Produk "${foundProduct.name}" berhasil ditambahkan ke cart`);
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Produk ditambahkan: ${foundProduct.name}`,
        });

        // Opsional: putar notifikasi suara
        const audio = new Audio("/audio.mp3");
        audio.play().catch((err) => console.error("Error putar audio:", err));
      }
    } catch (error) {
      console.error("Scan error detail:", error);
      toast.error("Terjadi kesalahan saat memproses scan");
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
            /* abaikan */
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
