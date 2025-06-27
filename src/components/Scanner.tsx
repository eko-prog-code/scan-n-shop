import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import type { Product, CartItem } from "@/types/product";

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
      // 1) Get all products from database
      const prodSnap = await get(ref(db, "products"));
      const products = (prodSnap.val() as Record<string, Product>) || {};

      // Find product with matching barcode
      const entries = Object.entries(products);
      const foundEntry = entries.find(([, p]) => p.barcode === decodedText);

      if (!foundEntry) {
        toast.error("Produk tidak ditemukan");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Produk tidak ditemukan di database",
        });
        return;
      }

      const [productId, foundProduct] = foundEntry;

      // Validate product price
      if (typeof foundProduct.regularPrice !== "number") {
        toast.error("Data produk tidak valid");
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: "Harga produk tidak valid",
        });
        return;
      }

      // 2) Update cart using transaction
      const itemsRef = ref(db, "cart/global/items");
      const transactionResult = await runTransaction(itemsRef, (currentData) => {
        const itemsObj = (currentData as Record<string, CartItem>) || {};

        // 2.a) Check for duplicate items
        for (const [, itemObj] of Object.entries(itemsObj)) {
          if (itemObj.id === productId) {
            return undefined; // abort if product exists
          }
        }

        // 2.b) Calculate next index
        const numericKeys = Object.keys(itemsObj)
          .map((k) => parseInt(k, 10))
          .filter((n) => !isNaN(n));
        const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : -1;
        const nextIndex = maxKey + 1;

        // 2.c) Add new item with timestamp
        itemsObj[nextIndex.toString()] = {
          ...foundProduct,
          id: productId,
          quantity: 1,
          price: foundProduct.regularPrice, // Use regularPrice as price
          addedAt: new Date().toISOString(),
        };

        return itemsObj;
      });

      if (!transactionResult.committed) {
        toast.error(`Produk "${foundProduct.name}" sudah ada di keranjang`);
        setLastScan({
          barcode: decodedText,
          status: "error",
          message: `Produk "${foundProduct.name}" sudah ada di keranjang`,
        });
      } else {
        toast.success(`"${foundProduct.name}" ditambahkan ke keranjang`);
        setLastScan({
          barcode: decodedText,
          status: "success",
          message: `Berhasil: ${foundProduct.name}`,
        });

        // Play notification sound
        new Audio("/audio.mp3").play().catch(() => {});
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Gagal memproses scan");
      setLastScan({
        barcode: decodedText,
        status: "error",
        message: "Gagal memproses scan",
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
        () => {} // Quietly handle QR reading errors
      );
      setIsScanning(true);
      setLastScan(null);
    } catch (error) {
      console.error("Scanner error:", error);
      toast.error("Gagal mengaktifkan kamera");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (error) {
        console.error("Stop scanner error:", error);
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
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
          <div className={`p-4 border-t ${
            lastScan.status === "success" 
              ? "bg-green-50 text-green-800" 
              : "bg-red-50 text-red-800"
          }`}>
            <p className="font-medium mb-1">
              {lastScan.status === "success" ? "Berhasil" : "Gagal"}
            </p>
            <p className="text-sm">Barcode: {lastScan.barcode}</p>
            <p className="text-sm mt-1">{lastScan.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
