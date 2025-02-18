
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  regularPrice: number;
}

const Cart = () => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const itemsRef = ref(db, 'global/items');
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const itemsArray = Object.values(data).filter((item: any) => item.quantity > 0);
        setItems(itemsArray as CartItem[]);
      } else {
        setItems([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const total = items.reduce((sum, item) => sum + item.regularPrice * item.quantity, 0);

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Cart</h2>
        <div className="space-y-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center space-x-4 p-2 rounded-lg bg-gray-50"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-12 h-12 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    {item.quantity} × ${item.regularPrice.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${(item.regularPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
