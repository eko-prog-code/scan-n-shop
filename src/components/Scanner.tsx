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

  // Cetak log ke console dan juga ke elemen debug di UI
  const logDebug = (msg: string) => {
    console.log(msg);
    if (debugRef.current) {
      debugRef.current.innerText += msg + "\n";
      debugRef.current.scrollTop = debugRef.current.scrollHeight;
    }
  };

  // Salin isi debug ke clipboard
  const copyDebugToClipboard = async () => {
    if (!debugRef.current) return;
    const text = debugRef.current.innerText;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Debug console berhasil disalin");
    } catch (err) {
      toast.error("Gagal menyalin debug console");
      console.error("Copy to clipboard error:", err);
    }
  };

  const handleScan = async (decodedText: string) => {
    try {
      logDebug(`--- handleScan: mencoba barcode "${decodedText}" ---`);

      // 1) Ambil semua produk
      const prodSnap = await get(ref(db, "products"));
      const products = (prodSnap.val() as Record<string, Product>) || {};
      logDebug(`Produk di database: ${Object.keys(products).length} item`);

      // Cari entry [key, productObj] yang barcode-nya cocok
      const entries = Object.entries(products);
      const foundEntry = entries.find(([, p]) => p.barcode === decodedText);

      if (!foundEntry) {
        logDebug(`❌ Produk dengan barcode "${decodedText}" tidak ditemukan.`);
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
        `✅ Ditemukan produk: id="${productId}", data=${JSON.stringify(
          foundProduct
        )}`
      );

      // Pastikan field 'price' ada di objek
      if (typeof foundProduct.price !== "number") {
        logDebug(
          `‼️ Key "price" tidak ada atau bukan number di produk ${productId}`
        );
        toast.error("Data produk tidak valid (price)");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Data produk tidak valid",
        });
        return;
      }

      // 2) Jalankan runTransaction pada /cart/global/items
      const itemsRef = ref(db, "cart/global/items");
      logDebug("Memulai runTransaction di /cart/global/items");

      const transactionResult = await runTransaction(itemsRef, (currentData) => {
        logDebug(
          `runTransaction callback – currentData: ${JSON.stringify(
            currentData
          )}`
        );

        const itemsObj = (currentData as Record<string, any>) || {};

        // 2.a) Cek duplikat berdasarkan field 'id'
        for (const [key, itemObj] of Object.entries(itemsObj)) {
          if ((itemObj as any).id === productId) {
            logDebug(
              `⚠️ Duplikat: produk ${productId} sudah ada di cart (key="${key}").`
            );
            return undefined; // abort transaksi
          }
        }

        // 2.b) Hitung nextIndex (key numerik berurutan)
        const numericKeys = Object.keys(itemsObj)
          .map((k) => parseInt(k, 10))
          .filter((n) => !isNaN(n));
        const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : -1;
        const nextIndex = maxKey + 1;
        logDebug(`runTransaction callback – nextIndex: ${nextIndex}`);

        // 2.c) Tambahkan item baru
        itemsObj[nextIndex.toString()] = {
          id: productId,
          name: foundProduct.name,
          barcode: foundProduct.barcode,
          price: foundProduct.price,
          quantity: 1,
          createdAt: new Date().toISOString(),
        };
        logDebug(
          `runTransaction callback – menambahkan di key="${nextIndex}": ${JSON.stringify(
            itemsObj[nextIndex.toString()]
          )}`
        );

        // Kembalikan seluruh objek yang diupdate
        return itemsObj;
      });

      logDebug(`runTransaction – result: ${JSON.stringify(transactionResult)}`);

      if (!transactionResult.committed) {
        logDebug("⚠️ Transaksi dibatalkan (kemungkinan duplikat).");
        toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundProduct.name}" sudah ada di cart`,
        });
      } else {
        logDebug("✅ Transaksi berhasil committed.");
        toast.success(
          `Produk "${foundProduct.name}" berhasil ditambahkan ke cart`
        );
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Produk ditambahkan: ${foundProduct.name}`,
        });

        // Opsional: putar suara notifikasi
        const audio = new Audio("/audio.mp3");
        audio.play().catch((err) => logDebug(`Error putar audio: ${err}`));
      }
    } catch (error: any) {
      logDebug(`❌ Exception di handleScan: ${error}`);
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
        // Filter hanya error yang bukan “No barcode detected”
        (errorMessage: string) => {
          if (!errorMessage.includes("No barcode or QR code detected")) {
            logDebug(`QR Error (serius): ${errorMessage}`);
          }
        }
      );
      setIsScanning(true);
      setLastScan(null);
      logDebug("🎥 Scanner berhasil dijalankan.");
    } catch (err) {
      logDebug(`❌ Gagal memulai scanner: ${err}`);
      console.error("Gagal memulai scanner:", err);
      toast.error("Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
        logDebug("🛑 Scanner dihentikan.");
      } catch (err) {
        logDebug(`❌ Error menghentikan scanner: ${err}`);
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
            logDebug("ℹ️ Scanner otomatis berhenti saat unmount.");
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

      {/* Tombol untuk menyalin isi Debug Console */}
      <div className="mt-4 flex items-center space-x-2">
        <button
          onClick={copyDebugToClipboard}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
        >
          Copy Debug Console
        </button>
        <span className="text-sm text-gray-600">(Klik untuk salin log)</span>
      </div>

      {/* Debug console: tampilkan log sebagai teks di HP */}
      <div className="mt-2">
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
