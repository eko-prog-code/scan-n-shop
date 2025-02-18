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
        <div className="flex flex-col items-center space-y-6">
          {/* Button Reload di tengah dengan icon */}
          <button 
            onClick={handleReload}
            className="px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors flex items-center space-x-2"
          >
            <span role="img" aria-label="reload">🔄</span>
            <span>Reload</span>
          </button>
          <div className="grid md:grid-cols-2 gap-6 w-full">
            <Scanner />
            <Cart />
          </div>
        </div>
      </main>
    </motion.div>
  );
};

export default Index;
