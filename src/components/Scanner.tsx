import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ref, get, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Camera, Zap, CheckCircle2, AlertCircle, Scan, Sparkles } from "lucide-react";
import type { Product } from "@/types/product";

const Scanner = () => {
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const [isScanning, setIsScanning] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [scanAnimation, setScanAnimation] = useState(false);
 const [lastScan, setLastScan] = useState<{
   barcode: string;
   status: "success" | "error";
   message: string;
 } | null>(null);

 const handleScan = async (decodedText: string) => {
   try {
     setIsLoading(true);
     setScanAnimation(true);
     
     // Animate scan effect
     setTimeout(() => setScanAnimation(false), 1000);

     // 1) Ambil semua produk
     const prodSnap = await get(ref(db, "products"));
     const products = (prodSnap.val() as Record<string, Product>) || {};

     // Cari entry [key, productObj] yang barcode-nya cocok
     const entries = Object.entries(products);
     const foundEntry = entries.find(([, p]) => p.barcode === decodedText);

     if (!foundEntry) {
       toast.error("Produk tidak ditemukan di database");
       setLastScan({
         barcode: decodedText,
         status: "error",
         message: "Produk tidak ditemukan di database",
       });
       return;
     }

     const [productId, foundProduct] = foundEntry;

     // Pastikan field 'price' ada di objek
     if (typeof foundProduct.price !== "number") {
       toast.error("Data produk tidak valid (price)");
       setLastScan({
         barcode: decodedText,
         status: "error",
         message: "Data produk tidak valid",
       });
       return;
     }

     // 2) Jalankan runTransaction pada /cart/global/items
     const itemsRef = ref(db, "cart/global/items");
     const transactionResult = await runTransaction(itemsRef, (currentData) => {
       const itemsObj = (currentData as Record<string, any>) || {};

       // 2.a) Cek duplikat berdasarkan field 'id'
       for (const [, itemObj] of Object.entries(itemsObj)) {
         if ((itemObj as any).id === productId) {
           return undefined; // abort transaksi
         }
       }

       // 2.b) Hitung nextIndex (key numerik berurutan)
       const numericKeys = Object.keys(itemsObj)
         .map((k) => parseInt(k, 10))
         .filter((n) => !isNaN(n));
       const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : -1;
       const nextIndex = maxKey + 1;

       // 2.c) Tambahkan item baru
       itemsObj[nextIndex.toString()] = {
         id: productId,
         name: foundProduct.name,
         barcode: foundProduct.barcode,
         price: foundProduct.price,
         quantity: 1,
         createdAt: new Date().toISOString(),
       };

       return itemsObj;
     });

     if (!transactionResult.committed) {
       toast.error(`Produk "${foundProduct.name}" sudah ada di cart`);
       setLastScan({
         barcode: decodedText,
         status: "error",
         message: `Produk "${foundProduct.name}" sudah ada di cart`,
       });
     } else {
       toast.success(
         `Produk "${foundProduct.name}" berhasil ditambahkan ke cart`
       );
       setLastScan({
         barcode: decodedText,
         status: "success",
         message: `Produk ditambahkan: ${foundProduct.name}`,
       });

       // Opsional: putar suara notifikasi
       const audio = new Audio("/audio.mp3");
       audio.play().catch(() => {});
     }
   } catch {
     toast.error("Terjadi kesalahan saat memproses scan");
     setLastScan({
       barcode: decodedText,
       status: "error",
       message: "Terjadi kesalahan saat memproses scan",
     });
   } finally {
     setIsLoading(false);
   }
 };

 const startScanner = async () => {
   try {
     setIsLoading(true);
     if (!scannerRef.current) {
       scannerRef.current = new Html5Qrcode("reader");
     }
     await scannerRef.current.start(
       { facingMode: "environment" },
       { fps: 10, qrbox: { width: 250, height: 250 } },
       handleScan,
       () => {
         // tidak perlu menampilkan error QR yang tidak penting
       }
     );
     setIsScanning(true);
     setLastScan(null);
   } catch {
     toast.error("Gagal mengaktifkan kamera. Pastikan izin sudah diberikan.");
   } finally {
     setIsLoading(false);
   }
 };

 const stopScanner = async () => {
   if (scannerRef.current && isScanning) {
     try {
       await scannerRef.current.stop();
       setIsScanning(false);
     } catch {
       // abaikan jika gagal menghentikan
     }
   }
 };

 useEffect(() => {
   startScanner();
   return () => {
     if (scannerRef.current && isScanning) {
       scannerRef.current
         .stop()
         .catch(() => {})
         .finally(() => {
           setIsScanning(false);
           scannerRef.current = null;
         });
     }
   };
 }, []);

 return (
   <div className="w-full max-w-lg mx-auto p-4">
     {/* Header Section */}
     <div className="text-center mb-6">
       <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full shadow-lg mb-4">
         <Scan className="w-5 h-5" />
         <span className="font-bold text-lg">Smart Scanner</span>
         <Sparkles className="w-5 h-5 animate-pulse" />
       </div>
       <p className="text-gray-600 text-sm">Scan barcode untuk menambahkan produk ke cart</p>
     </div>

     {/* Scanner Container */}
     <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-1">
       <div className="bg-white rounded-3xl overflow-hidden">
         {/* Scanning Animation Overlay */}
         {scanAnimation && (
           <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent animate-pulse">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-ping" />
           </div>
         )}
         
         {/* Loading Overlay */}
         {isLoading && (
           <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
             <div className="bg-white rounded-full p-4 shadow-lg">
               <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent" />
             </div>
           </div>
         )}

         {/* Scanner View */}
         <div className="relative">
           <div id="reader" className="w-full aspect-square bg-gray-100" />
           
           {/* Scanner Frame Overlay */}
           <div className="absolute inset-4 border-2 border-white rounded-2xl pointer-events-none">
             <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
             <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
             <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
             <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
             
             {/* Scanning Line */}
             {isScanning && (
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-bounce" />
             )}
           </div>
         </div>

         {/* Control Panel */}
         <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100">
           {!isScanning ? (
             <div className="text-center">
               <div className="inline-flex items-center gap-2 text-gray-600 mb-4">
                 <Camera className="w-5 h-5" />
                 <p className="font-medium">Kamera tidak aktif</p>
               </div>
               <button
                 onClick={startScanner}
                 disabled={isLoading}
                 className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isLoading ? (
                   <>
                     <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                     <span>Memulai...</span>
                   </>
                 ) : (
                   <>
                     <Zap className="w-5 h-5" />
                     <span>Mulai Scanner</span>
                   </>
                 )}
               </button>
             </div>
           ) : (
             <div className="text-center">
               <div className="inline-flex items-center gap-2 text-green-600 mb-4">
                 <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                 <p className="font-medium">Scanner Aktif</p>
               </div>
               <button
                 onClick={stopScanner}
                 className="inline-flex items-center gap-2 px-6 py-2 bg-red-500 text-white rounded-full font-medium shadow-lg hover:bg-red-600 transform hover:scale-105 transition-all duration-200"
               >
                 <span>Stop Scanner</span>
               </button>
             </div>
           )}
         </div>

         {/* Last Scan Result */}
         {lastScan && (
           <div className={`p-6 border-t-2 ${
             lastScan.status === "success" 
               ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" 
               : "bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
           }`}>
             <div className="flex items-start gap-3">
               {lastScan.status === "success" ? (
                 <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
               ) : (
                 <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
               )}
               <div className="flex-1">
                 <p className="font-bold text-gray-800 mb-1">Hasil Scan Terakhir</p>
                 <p className="text-sm text-gray-600 mb-2">
                   <span className="font-medium">Barcode:</span> {lastScan.barcode}
                 </p>
                 <p className={`text-sm font-medium ${
                   lastScan.status === "success" ? "text-green-700" : "text-red-700"
                 }`}>
                   {lastScan.message}
                 </p>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>

     {/* Tips Section */}
     <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
       <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
         <Sparkles className="w-4 h-4" />
         Tips Scanning
       </h3>
       <ul className="text-sm text-blue-700 space-y-1">
         <li>• Pastikan barcode terlihat jelas dalam frame</li>
         <li>• Hindari cahaya yang terlalu terang atau gelap</li>
         <li>• Jaga jarak 10-15cm dari barcode</li>
       </ul>
     </div>
   </div>
 );
};

export default Scanner;
