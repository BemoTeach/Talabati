import React, { useState } from 'react';
import { Product, CartItem } from '../types';
import { updateProductPrice, addProduct, completeReview } from '../services/productService';
import { Search, Plus, Save, CheckCircle, AlertTriangle, AlertCircle, ShoppingCart, Sparkles, Flame } from 'lucide-react';
import OrderSheet from './OrderSheet';

interface Props {
  products: Product[];
  refreshData: () => void;
  reviewMode: boolean;
  onExitReviewMode?: () => void;
  isAdmin?: boolean; // Add prop to check if user is admin
}

const MerchantView: React.FC<Props> = ({ products, refreshData, reviewMode, onExitReviewMode, isAdmin = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);
  
  // New Product State
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Check if product was updated in last 24 hours
  const isRecentlyUpdated = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Filter products
  const filteredProducts = products.filter(p => {
      const matchesSearch = p.name.includes(searchTerm);
      if (reviewMode) {
          return p.is_review_requested && matchesSearch;
      }
      return matchesSearch;
  });

  const handleEditClick = (p: Product) => {
    setEditingId(p.id);
    setTempPrice(p.price !== null && p.price !== undefined ? p.price.toString() : '');
  };

  const handleSavePrice = async (p: Product) => {
    try {
      await updateProductPrice(p.id, tempPrice);
      
      // If in review mode, mark as complete automatically when saved
      if (p.is_review_requested) {
          await completeReview(p.id);
      }
      
      setEditingId(null);
      refreshData();
    } catch (e: any) {
      console.error(e);
      alert("حدث خطأ أثناء الحفظ: " + (e.message || "خطأ غير معروف"));
    }
  };

  const handleMarkReviewed = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          await completeReview(id);
          refreshData();
      } catch (e) {
          alert("خطأ في الشبكة");
      }
  };

  const addToCart = (p: Product, e: React.MouseEvent) => {
      e.stopPropagation();
      if (p.price === null) {
          alert("لا يمكن إضافة منتج غير مسعر. يرجى تسعيره أولاً.");
          return;
      }
      
      setCart(prev => {
          const existing = prev.find(item => item.productId === p.id);
          if (existing) {
              return prev.map(item => item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item);
          }
          return [...prev, {
              productId: p.id,
              name: p.name,
              originalPrice: Number(p.price),
              quantity: 1
          }];
      });
      // Optional: Give feedback
  };

  const handleAddNew = async () => {
      if (!newName) return;
      setIsSubmitting(true);
      setErrorMsg(null);
      try {
          await addProduct(newName, newPrice);
          setNewName('');
          setNewPrice('');
          setIsAddModalOpen(false);
          refreshData();
      } catch (e: any) {
          console.error(e);
          setErrorMsg("فشل الإضافة: " + (e.message || "خطأ في الشبكة"));
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="pb-24">
      {/* Order Sheet Modal - Only active if Admin */}
      {isAdmin && (
          <OrderSheet 
            isOpen={isOrderSheetOpen} 
            onClose={() => setIsOrderSheetOpen(false)} 
            cart={cart}
            setCart={setCart}
          />
      )}

      {/* Review Mode Banner */}
      {reviewMode && (
          <div className="bg-orange-100 border-b-2 border-orange-400 p-4 sticky top-16 z-20 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                  <span className="font-bold text-lg">مطلوب مراجعة الأسعار ({filteredProducts.length})</span>
              </div>
              {onExitReviewMode && (
                  <button onClick={onExitReviewMode} className="text-sm bg-white px-3 py-1 rounded border border-orange-300">
                      إلغاء
                  </button>
              )}
          </div>
      )}

      {/* Search Bar */}
      <div className="sticky top-0 z-10 bg-gray-100 p-4 shadow-sm flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="بحث عن منتج..."
            className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-3 top-3.5 text-gray-400 w-6 h-6" />
        </div>
        {/* Only show Cart button if Admin */}
        {!reviewMode && isAdmin && (
            <button 
                onClick={() => setIsOrderSheetOpen(true)}
                className="bg-slate-800 text-white px-4 rounded-xl flex items-center justify-center relative shadow-sm"
            >
                <ShoppingCart className="w-6 h-6" />
                {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-gray-100">
                        {cart.length}
                    </span>
                )}
            </button>
        )}
      </div>

      {/* Product List */}
      <div className="p-4 space-y-3">
        {filteredProducts.map((product) => {
          const isUpdatedRecently = isRecentlyUpdated(product.last_updated) && !product.is_review_requested;
          
          return (
            <div 
                key={product.id} 
                className={`
                    relative bg-white rounded-xl shadow-sm border p-4 transition-all duration-300
                    ${product.is_review_requested ? 'border-orange-400 ring-1 ring-orange-200 bg-orange-50' : 'border-gray-100'}
                    ${isUpdatedRecently ? 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/30' : ''}
                `}
            >
                {/* Visual Indicator for Recent Update */}
                {isUpdatedRecently && (
                    <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-bl-lg rounded-tr-lg font-bold flex items-center gap-1 shadow-sm z-10">
                        <Flame className="w-3 h-3 fill-white" />
                        سعر جديد
                    </div>
                )}

                <div className="flex justify-between items-start gap-3">
                <div className="flex-1 pt-1" onClick={() => handleEditClick(product)}>
                    <h3 className="font-bold text-gray-800 text-lg leading-snug mb-1">{product.name}</h3>
                    {product.is_review_requested && (
                        <span className="inline-block bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full mb-2">مراجعة مطلوبة</span>
                    )}
                </div>
                
                {editingId === product.id ? (
                    <div className="flex flex-col gap-2 w-32 animate-in fade-in slide-in-from-right-4 duration-300">
                    <input
                        type="number"
                        className="w-full p-2 border-2 border-emerald-500 rounded-lg text-center text-lg font-bold bg-white"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        autoFocus
                    />
                    <button 
                        onClick={() => handleSavePrice(product)}
                        className="bg-emerald-600 text-white p-2 rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                        <Save className="w-4 h-4" /> حفظ
                    </button>
                    </div>
                ) : (
                    <div 
                        onClick={() => handleEditClick(product)}
                        className="flex flex-col items-end min-w-[80px]"
                    >
                    <span className={`text-xl font-bold ${product.price !== null ? 'text-emerald-700' : 'text-gray-400'} ${isUpdatedRecently ? 'text-amber-600' : ''}`}>
                        {product.price !== null ? Number(product.price).toLocaleString() : '---'}
                    </span>
                    <span className="text-xs text-gray-500 mb-2">جنية</span>
                    
                    {reviewMode && product.is_review_requested ? (
                        <button 
                            onClick={(e) => handleMarkReviewed(product.id, e)}
                            className="mt-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1"
                        >
                            <CheckCircle className="w-3 h-3" /> تم
                        </button>
                    ) : (
                        /* Only show Add to Cart if Admin */
                        !reviewMode && isAdmin && product.price !== null && (
                            <button 
                                onClick={(e) => addToCart(product, e)}
                                className="bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 p-2 rounded-full transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        )
                    )}
                    </div>
                )}
                </div>
            </div>
          );
        })}
        
        {filteredProducts.length === 0 && (
            <div className="text-center py-10 text-gray-400">
                <p>لا توجد منتجات مطابقة</p>
            </div>
        )}
      </div>

      {/* Add Button (Floating) - Only if Admin */}
      {!reviewMode && isAdmin && (
          <button 
            onClick={() => { setIsAddModalOpen(true); setErrorMsg(null); }}
            className="fixed left-6 bottom-6 bg-emerald-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30"
          >
            <Plus className="w-8 h-8" />
          </button>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4 text-emerald-800">إضافة سلعة جديدة</h2>
            
            {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errorMsg}
                </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">اسم المنتج</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="مثال: سكر 10 كيلو"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">السعر (اختياري)</label>
                <input 
                  type="number" 
                  value={newPrice} 
                  onChange={e => setNewPrice(e.target.value)}
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0"
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button 
                    onClick={handleAddNew}
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                >
                    {isSubmitting ? 'جاري الإضافة...' : 'إضافة'}
                </button>
                <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold"
                >
                    إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantView;