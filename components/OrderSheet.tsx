import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem, Order } from '../types';
import { ShoppingCart, Plus, Minus, Trash2, Save, Copy, X, History, ChevronDown, Check, Edit2, Truck, Percent } from 'lucide-react';
import { saveOrder, fetchOrders, deleteOrder, updateOrder } from '../services/productService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const OrderSheet: React.FC<Props> = ({ isOpen, onClose, cart, setCart }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [globalProfitMargin, setGlobalProfitMargin] = useState(0); // Percentage
  const [deliveryCost, setDeliveryCost] = useState<string>(''); // Kept as string for input handling
  const [savedOrders, setSavedOrders] = useState<Order[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null); // If editing an existing order
  const [orderName, setOrderName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
        setIsLoadingHistory(true);
        fetchOrders()
            .then(setSavedOrders)
            .catch(console.error)
            .finally(() => setIsLoadingHistory(false));
    }
  }, [activeTab]);

  const updateQuantity = (productId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              const newQty = Math.max(1, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const updateItemProfit = (productId: string, profit: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              return { ...item, itemProfit: profit };
          }
          return item;
      }));
  };

  const removeItem = (productId: string) => {
      setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Calculations
  const totals = useMemo(() => {
      let subTotal = 0;
      
      cart.forEach(item => {
          // Use item specific profit if set, otherwise global
          const margin = item.itemProfit !== undefined ? item.itemProfit : globalProfitMargin;
          const unitPriceWithProfit = item.originalPrice * (1 + margin / 100);
          subTotal += unitPriceWithProfit * item.quantity;
      });

      const delivery = Number(deliveryCost) || 0;
      const grandTotal = subTotal + delivery;
      
      return { subTotal, delivery, grandTotal };
  }, [cart, globalProfitMargin, deliveryCost]);

  const generateReceiptText = () => {
    // Determine Order Name/ID
    const title = orderName || 'بدون رقم';

    let text = `✅ تم استلام طلبك\n`;
    text += `رقم الطلب: ${title}\n\n`;
    text += `المنتجات:\n`;
    
    cart.forEach((item) => {
        const margin = item.itemProfit !== undefined ? item.itemProfit : globalProfitMargin;
        const unitPriceWithProfit = item.originalPrice * (1 + margin / 100);
        const itemTotal = unitPriceWithProfit * item.quantity;
        
        text += `${item.name} × ${item.quantity} = ${Math.round(itemTotal).toLocaleString()}\n`;
    });
    
    text += `\n💰 الإجمالي: ${Math.round(totals.subTotal).toLocaleString()} جنيه\n`;
    
    if (totals.delivery > 0) {
        text += `🚚 التوصيل: ${Math.round(totals.delivery).toLocaleString()} جنيه\n`;
    }
    
    text += `الاجمالي الكلي: ${Math.round(totals.grandTotal).toLocaleString()} جنية\n`;
    text += `📦 التسليم اليوم مساءً إن شاء الله\n\n`;
    text += `شكرًا لثقتك 🌸`;
    return text;
  };

  const handleCopy = () => {
      const text = generateReceiptText();
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSave = async () => {
      if (cart.length === 0) return;
      
      const name = orderName || `طلب ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}`;
      
      try {
          const orderData = {
              name,
              items: cart,
              profit_margin: globalProfitMargin,
              delivery_cost: Number(deliveryCost) || 0,
              total_price: totals.grandTotal
          };

          if (currentOrderId) {
              await updateOrder(currentOrderId, orderData);
              alert("تم تحديث الطلب بنجاح");
          } else {
              await saveOrder(orderData);
              alert("تم حفظ الطلب الجديد");
          }
          
          setOrderName('');
          setDeliveryCost('');
          setCurrentOrderId(null);
          setCart([]);
          onClose();
      } catch (e: any) {
          console.error(e);
          alert("فشل الحفظ: " + (e.message || "خطأ غير معروف. تأكد من تحديث قاعدة البيانات من زر الإصلاح في لوحة التحكم."));
      }
  };

  const loadOrderToCart = (order: Order) => {
      setCart(order.items);
      setGlobalProfitMargin(Number(order.profit_margin) || 0);
      setDeliveryCost(order.delivery_cost?.toString() || '');
      setOrderName(order.name);
      setCurrentOrderId(order.id);
      setActiveTab('current');
  };

  const handleDeleteOrder = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!window.confirm("حذف هذا السجل؟")) return;
      try {
          await deleteOrder(id);
          setSavedOrders(prev => prev.filter(o => o.id !== id));
      } catch (e) {
          alert("فشل الحذف");
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sliding Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center shadow-md z-10">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-emerald-400" />
                إدارة الطلبات (Admin)
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
            <button 
                onClick={() => setActiveTab('current')}
                className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'current' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50' : 'text-gray-500'}`}
            >
                <Edit2 className="w-4 h-4" />
                الطلب الحالي ({cart.length})
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'history' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50' : 'text-gray-500'}`}
            >
                <History className="w-4 h-4" />
                السجل المحفوظ
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {activeTab === 'current' && (
                <>
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                            <p>السلة فارغة</p>
                            <p className="text-sm">أضف منتجات من القائمة الرئيسية</p>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-20">
                            {/* Order Name */}
                            <input 
                                className="w-full p-2 border rounded-lg mb-2 text-sm"
                                placeholder="اسم الطلب / رقم الطلب"
                                value={orderName}
                                onChange={e => setOrderName(e.target.value)}
                            />

                            {/* Items List */}
                            <div className="space-y-3">
                                {cart.map(item => {
                                    const itemMargin = item.itemProfit !== undefined ? item.itemProfit : globalProfitMargin;
                                    const effectivePrice = item.originalPrice * (1 + itemMargin / 100);
                                    
                                    return (
                                        <div key={item.productId} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800">{item.name}</span>
                                                <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-sm text-gray-500">
                                                    الأساسي: {item.originalPrice.toLocaleString()}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                                                     <Percent className="w-3 h-3 text-slate-500"/>
                                                     <input 
                                                        type="number"
                                                        className="w-8 bg-transparent text-center border-b border-slate-300 focus:border-emerald-500 outline-none"
                                                        value={item.itemProfit !== undefined ? item.itemProfit : ''}
                                                        placeholder={globalProfitMargin.toString()}
                                                        onChange={(e) => updateItemProfit(item.productId, Number(e.target.value))}
                                                     />
                                                     <span>%</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center border-t pt-2">
                                                <div className="font-bold text-emerald-700">
                                                    {Math.round(effectivePrice * item.quantity).toLocaleString()} جنية
                                                </div>
                                                <div className="flex items-center gap-3 bg-gray-100 rounded-lg px-2 py-1">
                                                    <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded shadow-sm"><Minus className="w-3 h-3"/></button>
                                                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded shadow-sm"><Plus className="w-3 h-3"/></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Global Settings */}
                            <div className="bg-white p-4 rounded-lg shadow-sm mt-4 border border-slate-200 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">نسبة الربح العامة (%)</label>
                                    <div className="flex gap-4 items-center">
                                        <input 
                                            type="range" min="0" max="100" step="1"
                                            value={globalProfitMargin}
                                            onChange={e => setGlobalProfitMargin(Number(e.target.value))}
                                            className="flex-1 accent-emerald-600"
                                        />
                                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-bold min-w-[3rem] text-center">
                                            {globalProfitMargin}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">يتم تطبيقها على المنتجات التي لم تحدد لها نسبة خاصة</p>
                                </div>
                                
                                <div className="border-t pt-3">
                                     <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <Truck className="w-4 h-4"/>
                                        تكلفة التوصيل
                                     </label>
                                     <input 
                                        type="number"
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="0"
                                        value={deliveryCost}
                                        onChange={e => setDeliveryCost(e.target.value)}
                                     />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'history' && (
                <div className="space-y-3">
                    {isLoadingHistory ? (
                        <p className="text-center text-gray-500 mt-10">جاري التحميل...</p>
                    ) : savedOrders.length === 0 ? (
                        <p className="text-center text-gray-400 mt-10">لا توجد طلبات محفوظة</p>
                    ) : (
                        savedOrders.map(order => (
                            <div key={order.id} onClick={() => loadOrderToCart(order)} className="bg-white p-3 rounded-lg shadow-sm border hover:border-emerald-400 cursor-pointer transition-colors group relative">
                                <div className="font-bold text-gray-800 mb-1">{order.name || 'بدون اسم'}</div>
                                <div className="text-xs text-gray-500 mb-2">
                                    {new Date(order.created_at).toLocaleDateString('ar-EG')} • {order.items.length} منتج
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="font-bold text-emerald-600">
                                        {Number(order.total_price).toLocaleString()} جنية
                                    </div>
                                    {order.delivery_cost && order.delivery_cost > 0 && (
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                                            <Truck className="w-3 h-3"/> {order.delivery_cost}
                                        </span>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => handleDeleteOrder(order.id, e)}
                                    className="absolute top-3 left-3 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        {/* Footer Actions (Only for Current Tab) */}
        {activeTab === 'current' && cart.length > 0 && (
            <div className="p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>المجموع:</span>
                        <span>{Math.round(totals.subTotal).toLocaleString()}</span>
                    </div>
                    {totals.delivery > 0 && (
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>التوصيل:</span>
                            <span>{Math.round(totals.delivery).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-xl text-slate-900 border-t pt-2 mt-2">
                        <span>الإجمالي الكلي:</span>
                        <span>{Math.round(totals.grandTotal).toLocaleString()}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleCopy}
                        className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        {copySuccess ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                        {copySuccess ? 'تم النسخ' : 'نسخ الطلب'}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                    >
                        <Save className="w-5 h-5" />
                        {currentOrderId ? 'تحديث' : 'حفظ'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default OrderSheet;