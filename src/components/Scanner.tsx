import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, get, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import type { Product } from '@/types/product';

const Scanner = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{
    barcode: string;
    status: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleScan = async (decodedText: string) => {
    try {
      // Cari produk berdasarkan barcode di database
      const productRef = ref(db, `products`);
      const snapshot = await get(productRef);
      const products = (snapshot.val() as Record<string, Product>) || {};

      const foundProduct = Object.values(products).find(
        (product: Product) => product.barcode === decodedText
      );

      if (!foundProduct) {
        toast.error('Produk tidak ditemukan');
        setLastScan({
          barcode: decodedText,
          status: 'error',
          message: 'Produk tidak ditemukan di database'
        });
        return;
      }

      // Gunakan barcode sebagai key untuk menghindari duplikasi.
      // Dengan begitu, jika produk dengan barcode yang sama sudah ada,
      // transaksi akan dibatalkan.
      const itemRef = ref(db, `cart/global/items/${foundProduct.barcode}`);

      // Gunakan transaction agar pengecekan dan penambahan terjadi secara atomik.
      const transactionResult = await runTransaction(itemRef, (currentData) => {
        if (currentData !== null) {
          // Jika produk sudah ada, batalkan transaction.
          return;
        }
        // Jika belum ada, tambahkan produk dengan quantity 1.
        // Penting: tetapkan properti id sebagai barcode untuk konsistensi.
        return {
          ...foundProduct,
          id: foundProduct.barcode, // Override id dengan barcode
          quantity: 1,
        };
      });

      if (!transactionResult.committed) {
        toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
        setLastScan({
          barcode: decodedText,
          status: 'error',
          message: `Produk "${foundProduct.name}" sudah ada di cart`
        });
      } else {
        toast.success(`Produk "${foundProduct.name}" berhasil ditambahkan ke cart`);
        setLastScan({
          barcode: decodedText,
          status: 'success',
          message: `Produk ditambahkan: ${foundProduct.name}`
        });
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat memproses scan');
      console.error('Scan error:', error);
      setLastScan({
        barcode: decodedText,
        status: 'error',
        message: 'Terjadi kesalahan saat memproses scan'
      });
    }
  };

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('reader');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        (errorMessage: string) => {
          console.log('QR Error:', errorMessage);
        }
      );
      setIsScanning(true);
      setLastScan(null);
    } catch (err) {
      console.error('Gagal memulai scanner:', err);
      toast.error('Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error menghentikan scanner:', err);
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
            // Menangani error jika scanner sudah tidak aktif
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
          <div className={`p-4 border-t ${lastScan.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="font-medium mb-1">Hasil Scan Terakhir:</p>
            <p className="text-sm text-gray-600">Barcode: {lastScan.barcode}</p>
            <p className={`text-sm ${lastScan.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {lastScan.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
