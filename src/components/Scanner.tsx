
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import type { Product } from '@/types/product';

const Scanner = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleScan = async (decodedText: string) => {
    try {
      const itemRef = ref(db, `global/items`);
      const snapshot = await get(itemRef);
      const items = snapshot.val() as Record<string, Product> || {};
      
      const foundItem = Object.values(items).find((item: Product) => 
        item.barcode === decodedText
      );

      if (foundItem) {
        const updatedItem: Product = {
          ...foundItem,
          quantity: (foundItem.quantity || 0) + 1
        };
        await set(ref(db, `global/items/${foundItem.id}`), updatedItem);
        toast.success(`Added ${foundItem.name} to cart`);
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      toast.error('Error processing scan');
      console.error('Scan error:', error);
    }
  };

  useEffect(() => {
    scannerRef.current = new Html5Qrcode('reader');
    
    scannerRef.current
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        (errorMessage: string) => {
          console.log(errorMessage);
        }
      )
      .catch((err: any) => {
        console.error('Scanner error:', err);
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch((err: any) => console.error('Error stopping scanner:', err));
      }
    };
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="rounded-lg overflow-hidden shadow-lg bg-white">
        <div id="reader" className="w-full aspect-square" />
      </div>
    </div>
  );
};

export default Scanner;
