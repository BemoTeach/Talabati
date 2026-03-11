import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Search, ShoppingCart, Plus, Minus, Send } from 'lucide-react';

interface CustomerViewProps {
  products: Product[];
  whatsappNumber: string;
}

const CustomerView: React.FC<CustomerViewProps> = ({ products, whatsappNumber }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<{ [key: string]: number }>({});

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
      p.price !== null // Only show products with prices
    );
  }, [products, searchTerm]);

  const handleQuantityChange = (productId: string, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[productId];
      } else {
        newCart[productId] = next;
      }
      return newCart;
    });
  };

  const cartTotal = useMemo(() => {
    let total = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      const product = products.find(p => p.id === id);
      if (product && product.price !== null) {
        total += Number(product.price) * qty;
      }
    });
    return total;
  }, [cart, products]);

  const handleSendOrder = () => {
    if (Object.keys(cart).length === 0) return;
    if (!whatsappNumber) {
      alert("عذراً، لم يتم تحديد رقم واتساب للطلب.");
      return;
    }

    let message = "طلب جديد:\n\n";
    Object.entries(cart).forEach(([id, qty]) => {
      const product = products.find(p => p.id === id);
      if (product && product.price !== null) {
        message += `- ${product.name}: ${qty} x ${product.price} = ${Number(product.price) * qty}\n`;
      }
    });
    message += `\nالإجمالي: ${cartTotal} جنيه`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="pb-24" dir="rtl">
      {/* Search Bar */}
      <div className="px-4 mb-6 sticky top-0 bg-gray-50 pt-4 pb-2 z-10">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            className="w-full p-4 pr-12 rounded-2xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-lg shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
        </div>
      </div>

      {/* Product List */}
      <div className="px-4 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            لا توجد منتجات مطابقة للبحث
          </div>
        ) : (
          filteredProducts.map(product => {
            const qty = cart[product.id] || 0;
            return (
              <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
                  <div className="text-emerald-600 font-bold mt-1">
                    {Number(product.price).toLocaleString()} جنيه
                  </div>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl border border-gray-200">
                  <button 
                    onClick={() => handleQuantityChange(product.id, 1)}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-emerald-600 active:scale-95 transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <span className="font-bold w-6 text-center">{qty}</span>
                  <button 
                    onClick={() => handleQuantityChange(product.id, -1)}
                    disabled={qty === 0}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${qty === 0 ? 'text-gray-300' : 'bg-white shadow-sm text-red-500 active:scale-95'}`}
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Cart Summary */}
      {Object.keys(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">الإجمالي</p>
              <p className="text-2xl font-bold text-emerald-600">{cartTotal.toLocaleString()} جنيه</p>
            </div>
            <button 
              onClick={handleSendOrder}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Send className="w-5 h-5" />
              إرسال الطلب
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerView;
