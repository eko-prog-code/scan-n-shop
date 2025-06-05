import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction } from "firebase/database";
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
      // 1) Ambil semua produk
      const prodSnap = await get(ref(db, "products"));
      const products = (prodSnap.val() as Record<string, Product>) || {};

      // Cari product berdasarkan barcode
      const entries = Object.entries(products);
      const foundEntry = entries.find(([, p]) => p.barcode === decodedText);

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

      // Pastikan field 'price' ada
      if (typeof foundProduct.price !== "number") {
        toast.error("Data produk tidak valid");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Data produk tidak valid",
        });
        return;
      }

      // 2) runTransaction di /cart/global/items
      const itemsRef = ref(db, "cart/global/items");
      const transactionResult = await runTransaction(itemsRef, (currentData) => {
        const itemsObj = (currentData as Record<string, any>) || {};

        // Cek duplikat berdasarkan field 'id'
        for (const itemObj of Object.values(itemsObj)) {
          if ((itemObj as any).id === productId) {
            return undefined; // abort transaksi jika duplikat
          }
        }

        // Hitung nextIndex (key numerik)
        const numericKeys = Object.keys(itemsObj)
          .map((k) => parseInt(k, 10))
          .filter((n) => !isNaN(n));
        const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : -1;
        const nextIndex = maxKey + 1;

        // Tambahkan item baru
        itemsObj[nextIndex.toString()] = {
          id: productId,
          name: foundProduct.name,
          barcode: foundProduct.barcode,
          price: foundProduct.price,
          quantity: 1,
          createdAt: new Date().toISOString(),
        };

        return itemsObj;
      });

      if (!transactionResult.committed) {
        toast.error(`Produk "${foundEntry[1].name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundEntry[1].name}" sudah ada di cart`,
        });
      } else {
        toast.success(`Produk "${foundEntry[1].name}" berhasil ditambahkan ke cart`);
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Produk ditambahkan: ${foundEntry[1].name}`,
        });

        // (Opsional) putar notifikasi suara
        const audio = new Audio("/audio.mp3");
        audio.play().catch(() => {});
      }
    } catch {
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
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScan,
        () => {
          // kosongkan atau abaikan error "No barcode detected"
        }
      );
      setIsScanning(true);
      setLastScan(null);
    } catch {
      toast.error("Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch {
        // abaikan
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            setIsScanning(false);
            scannerRef.current = null;
          });
      }
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
            <p className="text-sm text-gray-600">Barcode: {lastScan.barcode}</p>
            <p
              className={`text-sm ${
                lastScan.status === "success" ? "text-green-600" : "text-red-600"
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
