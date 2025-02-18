import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, get, set, push } from 'firebase/database';
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
      const productRef = ref(db, `products`);
      const snapshot = await get(productRef);
      const products = snapshot.val() as Record<string, Product> || {};
      
      const foundProduct = Object.values(products).find((product: Product) => 
        product.barcode === decodedText
      );

      if (!foundProduct) {
        toast.error('Product not found');
        setLastScan({
          barcode: decodedText,
          status: 'error',
          message: 'Product not found in database'
        });
        return;
      }

      // Ambil referensi cart > global > items
      const itemsRef = ref(db, `cart/global/items`);
      const itemsSnapshot = await get(itemsRef);
      const items = itemsSnapshot.val() || {};

      // Cek apakah barcode sudah ada di items
      const existingItemKey = Object.keys(items).find((key) => 
        items[key].barcode === foundProduct.barcode
      );

      if (existingItemKey) {
        toast.error(`Product "${foundProduct.name}" already exists in cart`);
        setLastScan({
          barcode: decodedText,
          status: 'error',
          message: `Product "${foundProduct.name}" is already in cart`
        });
      } else {
        // Tambahkan produk ke items
        const newItemRef = push(itemsRef);
        await set(newItemRef, {
          ...foundProduct,
          quantity: 1, // Produk baru selalu ditambahkan dengan quantity 1
        });

        toast.success(`Added ${foundProduct.name} to cart`);
        setLastScan({
          barcode: decodedText,
          status: 'success',
          message: `Product added: ${foundProduct.name}`
        });
      }
    } catch (error) {
      toast.error('Error processing scan');
      console.error('Scan error:', error);
      setLastScan({
        barcode: decodedText,
        status: 'error',
        message: 'Error processing scan'
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
      console.error('Failed to start scanner:', err);
      toast.error('Failed to start camera. Please check permissions.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  useEffect(() => {
    startScanner();
    
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop()
          .catch(() => {
            // Menangani error scanner yang tidak aktif
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
            <p className="text-gray-600 mb-2">Camera not active</p>
            <button 
              onClick={startScanner}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Start Scanner
            </button>
          </div>
        )}
        {lastScan && (
          <div className={`p-4 border-t ${
            lastScan.status === 'success' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="font-medium mb-1">Last Scan Result:</p>
            <p className="text-sm text-gray-600">Barcode: {lastScan.barcode}</p>
            <p className={`text-sm ${
              lastScan.status === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {lastScan.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
