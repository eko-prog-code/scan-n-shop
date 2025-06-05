import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import type { Product } from "@/types/product";

const Scanner = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const debugRef = useRef<HTMLDivElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{
    barcode: string;
    status: "success" | "error";
    message: string;
  } | null>(null);

  // Fungsi untuk mencetak log ke console dan juga ke elemen debug pada UI
  const logDebug = (msg: string) => {
    console.log(msg);
    if (debugRef.current) {
      debugRef.current.innerText += msg + "\n";
      // Scroll ke bawah agar log terbaru terlihat
      debugRef.current.scrollTop = debugRef.current.scrollHeight;
    }
  };

  const handleScan = async (decodedText: string) => {
    try {
      logDebug(`--- Mulai handleScan untuk barcode: ${decodedText} ---`);

      // 1) Cari produk berdasarkan barcode di /products
      const prodSnap = await get(ref(db, "products"));
      const products = (prodSnap.val() as Record<string, Product>) || {};
      logDebug(`Jumlah produk di database: ${Object.keys(products).length}`);

      const entries = Object.entries(products);
      const foundEntry = entries.find(([, p]) => p.barcode === decodedText);
      if (!foundEntry) {
        logDebug(`Produk dengan barcode ${decodedText} tidak ditemukan.`);
        toast.error("Produk tidak ditemukan di database");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Produk tidak ditemukan di database",
        });
        return;
      }

      const [productId, foundProduct] = foundEntry;
      logDebug(
        `Produk ditemukan: id=${productId}, name="${foundProduct.name}", regularPrice=${foundProduct.regularPrice}`
      );

      if (!productId) {
        logDebug("productId undefined! Tidak dapat melanjutkan transaksi.");
        toast.error("Terjadi kesalahan: ID produk tidak valid");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "ID produk tidak valid",
        });
        return;
      }

      // 2) Jalankan runTransaction pada /cart/global/items
      const itemsRef = ref(db, "cart/global/items");
      logDebug("Memulai runTransaction di /cart/global/items");

      const transactionResult = await runTransaction(itemsRef, (currentData) => {
        logDebug(
          `runTransaction callback - currentData sebelum perubahan: ${JSON.stringify(
            currentData
          )}`
        );

        const itemsObj = (currentData as Record<string, any>) || {};

        // 2.a) Cek duplikat berdasarkan `id`
        for (const [key, itemObj] of Object.entries(itemsObj)) {
          if ((itemObj as any).id === productId) {
            logDebug(
              `Produk ${productId} sudah ada di cart pada key=${key}. Membatalkan transaksi.`
            );
            return undefined; // batalkan transaksi
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
        const nextIndex = maxKey + 1;
        logDebug(`runTransaction callback - nextIndex yang dihitung: ${nextIndex}`);

        // 2.c) Tambahkan item baru di index tersebut
        itemsObj[nextIndex.toString()] = {
          id: productId,
          name: foundProduct.name,
          barcode: foundProduct.barcode,
          price: Number(foundProduct.regularPrice),
          quantity: 1,
          createdAt: new Date().toISOString(),
        };
        logDebug(
          `runTransaction callback - menambahkan item baru di key="${nextIndex}": ${JSON.stringify(
            itemsObj[nextIndex.toString()]
          )}`
        );

        // Kembalikan seluruh itemsObj yang sudah diperbarui
        return itemsObj;
      });

      logDebug(`runTransaction - result: ${JSON.stringify(transactionResult)}`);

      if (!transactionResult.committed) {
        logDebug(`Transaksi dibatalkan (mungkin duplikat).`);
        toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundProduct.name}" sudah ada di cart`,
        });
      } else {
        logDebug(`Transaksi berhasil committed.`);
        toast.success(`Produk "${foundProduct.name}" berhasil ditambahkan ke cart`);
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Produk ditambahkan: ${foundProduct.name}`,
        });

        // (Opsional) Putar suara notifikasi
        const audio = new Audio("/audio.mp3");
        audio.play().catch((err) => logDebug(`Error memutar audio: ${err}`));
      }
    } catch (error: any) {
      logDebug(`Exception di handleScan: ${error}`);
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
          logDebug(`QR Error: ${errorMessage}`);
        }
      );
      setIsScanning(true);
      setLastScan(null);
      logDebug("Scanner berhasil dijalankan.");
    } catch (err) {
      logDebug(`Gagal memulai scanner: ${err}`);
      console.error("Gagal memulai scanner:", err);
      toast.error("Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
        logDebug("Scanner dihentikan.");
      } catch (err) {
        logDebug(`Error menghentikan scanner: ${err}`);
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
            /* sudah tidak aktif, abaikan */
          })
          .finally(() => {
            setIsScanning(false);
            scannerRef.current = null;
            logDebug("Scanner otomatis dihentikan saat unmount.");
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

      {/* Debug console: tampilkan log sebagai teks di HP */}
      <div className="mt-4">
        <h3 className="font-medium mb-1">Debug Console:</h3>
        <div
          ref={debugRef}
          className="h-32 overflow-y-auto bg-gray-100 text-xs text-gray-800 p-2 rounded"
          style={{ whiteSpace: "pre-wrap" }}
        ></div>
      </div>
    </div>
  );
};

export default Scanner;
