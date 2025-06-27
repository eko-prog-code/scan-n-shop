import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import type { CartItem } from '@/types/product';

const Cart = () => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const itemsRef = ref(db, "cart/global/items");
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, CartItem>;
      if (data) {
        // Konversi ke array dan urutkan berdasarkan addedAt (terbaru pertama)
        const itemsArray = Object.values(data)
          .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
        setItems(itemsArray);
      } else {
        setItems([]);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Cart ({items.length})</h2>
        <ul className="space-y-2">
          <AnimatePresence>
            {items.map((item) => (
              <motion.li
                key={`${item.id}-${item.addedAt}`} // Gunakan kombinasi id dan timestamp
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-3 rounded-lg bg-gray-50 border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    <p className="text-xs text-gray-400">
                      Added: {new Date(item.addedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="font-semibold">
                    ${(item.regularPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
};

export default Cart;
