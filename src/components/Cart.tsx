import { useEffect, useState } from "react";
import { ref, onValue, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface CartItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  createdAt: string; // ISO string timestamp
}

const Cart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cartRef = ref(db, "cart/global/items");
    
    const unsubscribe = onValue(cartRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object ke array dan urutkan berdasarkan createdAt (terbaru di atas)
        const itemsArray = Object.entries(data)
          .map(([key, item]: [string, any]) => ({
            key,
            ...item
          }))
          .sort((a, b) => {
            // Sort descending (terbaru di atas)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        
        setCartItems(itemsArray);
      } else {
        setCartItems([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateQuantity = async (itemKey: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemKey);
      return;
    }

    try {
      const itemRef = ref(db, `cart/global/items/${itemKey}`);
      await runTransaction(itemRef, (currentData) => {
        if (currentData) {
          return {
            ...currentData,
            quantity: newQuantity,
            updatedAt: new Date().toISOString() // Track last update
          };
        }
        return currentData;
      });
      toast.success("Kuantitas berhasil diperbarui");
    } catch (error) {
      toast.error("Gagal memperbarui kuantitas");
    }
  };

  const removeItem = async (itemKey: string) => {
    try {
      const itemsRef = ref(db, "cart/global/items");
      await runTransaction(itemsRef, (currentData) => {
        if (currentData && currentData[itemKey]) {
          const newData = { ...currentData };
          delete newData[itemKey];
          return newData;
        }
        return currentData;
      });
      toast.success("Item berhasil dihapus dari cart");
    } catch (error) {
      toast.error("Gagal menghapus item");
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const clearCart = async () => {
    try {
      const itemsRef = ref(db, "cart/global/items");
      await runTransaction(itemsRef, () => {
        return null; // Clear all items
      });
      toast.success("Cart berhasil dikosongkan");
    } catch (error) {
      toast.error("Gagal mengosongkan cart");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-lg mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header Cart */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Shopping Cart ({cartItems.length})
          </h2>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="max-h-96 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-6xl mb-4">🛒</div>
              <p>Cart masih kosong</p>
              <p className="text-sm">Scan barcode untuk menambah produk</p>
            </div>
          ) : (
            <div className="divide-y">
              {cartItems.map((item) => (
                <div key={item.key} className="p-4 hover:bg-gray-50">
                  {/* Item baru indicator */}
                  {new Date().getTime() - new Date(item.createdAt).getTime() < 5000 && (
                    <div className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mb-2">
                      Baru ditambahkan
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">Barcode: {item.barcode}</p>
                      <p className="text-sm text-gray-600 font-medium">
                        Rp {item.price.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-400">
                        Ditambahkan: {new Date(item.createdAt).toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {/* Quantity Controls */}
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"
                      >
                        -
                      </button>
                      <span className="min-w-[2rem] text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"
                      >
                        +
                      </button>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.key)}
                        className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="mt-2 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      Subtotal: Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer dengan Total */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-xl font-bold text-blue-600">
                Rp {getTotalPrice().toLocaleString('id-ID')}
              </span>
            </div>
            
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors">
              Checkout ({cartItems.length} items)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
