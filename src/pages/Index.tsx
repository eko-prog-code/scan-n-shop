import Scanner from '@/components/Scanner';
import Cart from '@/components/Cart';
import { motion } from 'framer-motion';

const Index = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50"
    >
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">Scan & Shop</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-6">
          <Scanner />
          <div>
            {/* Button Reload */}
            <button 
              onClick={handleReload}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reload
            </button>
            <Cart />
          </div>
        </div>
      </main>
    </motion.div>
  );
};

export default Index;
