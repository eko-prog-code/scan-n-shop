import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '@/types/product';

const Cart = () => {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    // Mengambil data dari path "cart/global/items"
    const itemsRef = ref(db, "cart/global/items");
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val() as Record<string, Product>;
      if (data) {
        const itemsArray = Object.values(data);
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
        <h2 className="text-xl font-semibold mb-4">Cart</h2>
        <ul className="space-y-2">
          <AnimatePresence>
            {items.map((item) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-2 rounded-lg bg-gray-50"
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">Barcode: {item.barcode}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
};

export default Cart;
