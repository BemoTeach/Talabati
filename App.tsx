import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Product } from './types';
import { fetchProducts, initializeData } from './services/productService';
import MerchantView from './components/MerchantView';
import AdminPanel from './components/AdminPanel';
import { ShoppingBag, Lock, Bell, RefreshCw, Database, Copy, Check } from 'lucide-react';
import { FIX_SQL } from './constants';

const ADMIN_PIN = '0000'; // Simple PIN for demo

function App() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [headerClicks, setHeaderClicks] = useState(0);
  const [pin, setPin] = useState('');
  
  // Error handling state
  const [initError, setInitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Ref for click timeout
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const triggerNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
       // Check if service worker is ready for mobile notifications
       if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(registration => {
             registration.showNotification(title, {
                body: body,
                icon: '/vite.svg',
                vibrate: [200, 100, 200]
             } as any);
          });
       } else {
          new Notification(title, { body, icon: '/vite.svg' });
       }
    }
    // Fallback sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    audio.play().catch(e => console.log('Audio play failed', e));
  };

  const loadData = async () => {
    setLoading(true);
    setInitError(null);
    try {
      // Try to initialize/seed first
      await initializeData();
      
      const data = await fetchProducts();
      setProducts(data);
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('Could not find the table') || error.message?.includes('does not exist')) {
          setInitError('TABLE_MISSING');
      } else {
          setInitError(error.message || "حدث خطأ غير متوقع");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const subscription = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        // Refresh Data
        loadData();

        // Check for Notification Logic
        if (payload.eventType === 'UPDATE') {
           const newData = payload.new as Product;
           const oldData = payload.old as Partial<Product>;
           
           // Notify Admin if a review is requested (Instant Notification)
           if (newData.is_review_requested && !oldData.is_review_requested) {
               triggerNotification('طلب مراجعة جديد 🔔', `تم طلب مراجعة سعر: ${newData.name}`);
           }
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleHeaderClick = () => {
    setHeaderClicks(prev => prev + 1);
    
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    
    clickTimeoutRef.current = setTimeout(() => {
      setHeaderClicks(0);
    }, 1000);

    if (headerClicks + 1 >= 3) {
      setShowLoginModal(true);
      setHeaderClicks(0);
    }
  };

  const handleLogin = () => {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      setShowLoginModal(false);
      setPin('');
    } else {
      alert("رمز خطأ");
      setPin('');
    }
  };

  const handleCopySQL = () => {
      navigator.clipboard.writeText(FIX_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  // 1. Render Error / Setup Screen
  if (initError === 'TABLE_MISSING') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-6 border-t-4 border-emerald-500">
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="bg-emerald-100 p-4 rounded-full mb-4">
                          <Database className="w-10 h-10 text-emerald-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800">تجهيز قاعدة البيانات</h2>
                      <p className="text-slate-600 mt-2">
                          جدول المنتجات غير موجود. يرجى إنشاء الجدول في Supabase لتشغيل التطبيق.
                      </p>
                  </div>

                  <div className="bg-slate-900 rounded-lg p-4 mb-6 relative group">
                      <pre className="text-emerald-400 font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap text-left dir-ltr h-40">
                          {FIX_SQL.trim()}
                      </pre>
                      <button 
                        onClick={handleCopySQL}
                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors"
                        title="نسخ الكود"
                      >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                  </div>

                  <div className="space-y-3">
                      <div className="text-sm text-slate-500 bg-slate-100 p-3 rounded-lg">
                          <ol className="list-decimal list-inside space-y-1">
                              <li>انسخ الكود أعلاه.</li>
                              <li>اذهب إلى لوحة تحكم <b>Supabase</b>.</li>
                              <li>افتح <b>SQL Editor</b> من القائمة الجانبية.</li>
                              <li>الصق الكود واضغط <b>Run</b>.</li>
                          </ol>
                      </div>
                      <button 
                        onClick={loadData}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                          <RefreshCw className="w-5 h-5" />
                          تم التنفيذ، أعد المحاولة
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 2. Render Loading
  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-gray-500 font-bold">جاري الاتصال بقاعدة البيانات...</p>
      </div>
    );
  }

  const pendingReviews = products.filter(p => p.is_review_requested).length;

  // 3. Render Admin Panel
  if (isAdmin) {
    return (
      <AdminPanel 
        products={products} 
        refreshData={loadData} 
        onLogout={() => setIsAdmin(false)} 
      />
    );
  }

  // 4. Render Merchant View (Main App)
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-gray-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">الدخول للإدارة</h2>
            </div>
            <input 
              type="tel" 
              className="w-full text-center text-3xl font-bold tracking-widest p-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none mb-6"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••"
            />
            <button 
              onClick={handleLogin}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
            >
              دخول
            </button>
            <button 
              onClick={() => setShowLoginModal(false)}
              className="w-full mt-3 text-gray-500 py-2"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-emerald-600 text-white pt-safe pb-4 px-4 shadow-lg rounded-b-[2rem] sticky top-0 z-30">
        <div className="flex justify-between items-center mt-2">
           <div 
             onClick={handleHeaderClick} 
             className="flex items-center gap-2 select-none cursor-pointer active:opacity-50 transition-opacity"
           >
             <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
               <ShoppingBag className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="font-bold text-lg">السوق السوداني</h1>
               <p className="text-emerald-100 text-xs">قائمة الأسعار</p>
             </div>
           </div>

           {pendingReviews > 0 && (
               <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-bounce shadow-lg">
                   <Bell className="w-3 h-3" />
                   {pendingReviews}
               </div>
           )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto pt-4">
        <MerchantView 
            products={products} 
            refreshData={loadData}
            reviewMode={pendingReviews > 0} 
            isAdmin={isAdmin} 
        />
      </main>
    </div>
  );
}

export default App;