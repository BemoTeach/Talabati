import React, { useState } from 'react';
import { Product, CartItem } from '../types';
import { requestReview, addProduct, addBatchProducts, deleteProducts } from '../services/productService';
import { exportCurrentList, exportHistoryTabs } from '../utils/excelExport';
import { Download, Send, CheckSquare, Square, Search, X, LogOut, PackagePlus, FileText, ListPlus, AlertCircle, CheckCircle, Trash2, Database, Copy, Check, ShoppingCart, Plus, Loader, Archive, FileDown } from 'lucide-react';
import { FIX_SQL } from '../constants';
import OrderSheet from './OrderSheet';

interface Props {
  products: Product[];
  refreshData: () => void;
  onLogout: () => void;
}

const AdminPanel: React.FC<Props> = ({ products, refreshData, onLogout }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'manage' | 'add'>('manage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Export states
  const [isSimpleExporting, setIsSimpleExporting] = useState(false);
  const [isBackupExporting, setIsBackupExporting] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);

  // SQL Help Modal
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Feedback Status
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Add Product State
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [bulkText, setBulkText] = useState('');

  const filteredProducts = products.filter(p => p.name.includes(searchTerm));

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
      if (selectedIds.size === filteredProducts.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredProducts.map(p => p.id)));
      }
  };

  const clearStatus = () => setStatusMsg(null);

  const handleCopySQL = () => {
      navigator.clipboard.writeText(FIX_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  // Simple List Export
  const handleSimpleExport = async () => {
      setIsSimpleExporting(true);
      try {
          exportCurrentList(products);
          setStatusMsg({type: 'success', text: "تم تنزيل القائمة الحالية"});
      } catch (e) {
          setStatusMsg({type: 'error', text: "حدث خطأ أثناء التصدير"});
      } finally {
          setIsSimpleExporting(false);
      }
  };

  // Full History Tabs Export
  const handleBackupExport = async () => {
      setIsBackupExporting(true);
      try {
          await exportHistoryTabs(products);
          setStatusMsg({type: 'success', text: "تم تنزيل سجل التعديلات (Backup)"});
      } catch (e) {
          setStatusMsg({type: 'error', text: "حدث خطأ أثناء تنزيل النسخة الاحتياطية"});
      } finally {
          setIsBackupExporting(false);
      }
  };

  const addToCart = (p: Product, e: React.MouseEvent) => {
      e.stopPropagation();
      if (p.price === null) {
          alert("لا يمكن إضافة منتج غير مسعر.");
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
      setStatusMsg({type: 'success', text: "تمت الإضافة للسلة"});
      setTimeout(clearStatus, 1500);
  };

  const handleSendReview = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    clearStatus();
    try {
      const batchId = `BATCH-${Math.floor(Math.random() * 10000)}`;
      await requestReview(Array.from(selectedIds), batchId);
      setStatusMsg({type: 'success', text: "تم إرسال طلب المراجعة بنجاح"});
      setSelectedIds(new Set());
      refreshData();
    } catch (e: any) {
      setStatusMsg({type: 'error', text: "فشل الإرسال: " + (e.message || "خطأ غير معروف")});
    } finally {
      setSending(false);
    }
  };

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      
      const confirmMsg = `هل أنت متأكد من حذف ${selectedIds.size} منتج؟ لا يمكن التراجع عن هذا الإجراء.`;
      if (!window.confirm(confirmMsg)) return;

      setIsDeleting(true);
      clearStatus();
      try {
          await deleteProducts(Array.from(selectedIds));
          setStatusMsg({type: 'success', text: "تم الحذف بنجاح"});
          setSelectedIds(new Set());
          refreshData();
      } catch (e: any) {
          console.error(e);
          const errorText = e.message || "خطأ غير معروف";
          setStatusMsg({type: 'error', text: `فشل الحذف (${errorText}). يرجى التحقق من إعدادات قاعدة البيانات.`});
      } finally {
          setIsDeleting(false);
      }
  };

  const handleSingleDelete = async (id: string) => {
      if (!window.confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) return;
      
      setIsDeleting(true);
      clearStatus();
      try {
          await deleteProducts([id]);
          setStatusMsg({type: 'success', text: "تم حذف المنتج"});
          
          if (selectedIds.has(id)) {
              const newSet = new Set(selectedIds);
              newSet.delete(id);
              setSelectedIds(newSet);
          }
          
          refreshData();
      } catch (e: any) {
          console.error(e);
          const errorText = e.message || "خطأ غير معروف";
          setStatusMsg({type: 'error', text: `فشل الحذف (${errorText}). يرجى التحقق من إعدادات قاعدة البيانات.`});
      } finally {
          setIsDeleting(false);
      }
  };

  const handleSingleAdd = async () => {
    if(!newProductName) return;
    setIsSubmitting(true);
    clearStatus();
    try {
        await addProduct(newProductName, newProductPrice);
        setNewProductName('');
        setNewProductPrice('');
        setStatusMsg({type: 'success', text: "تمت إضافة المنتج بنجاح"});
        refreshData();
    } catch(e: any) {
        console.error(e);
        setStatusMsg({type: 'error', text: "خطأ: " + (e.message || "تأكد من الاتصال")});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    setIsSubmitting(true);
    clearStatus();
    
    const lines = bulkText.split('\n');
    const productsToAdd: {name: string, price: string | null}[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(/^(.*)\s+([\d,.]+)$/);
        
        if (match) {
            const name = match[1].trim();
            const price = match[2];
            if (name) {
                productsToAdd.push({ name, price });
            }
        } else {
            productsToAdd.push({ name: trimmed, price: null });
        }
    }

    if (productsToAdd.length === 0) {
        setIsSubmitting(false);
        setStatusMsg({type: 'error', text: "لم يتم العثور على منتجات صالحة في النص"});
        return;
    }

    try {
        await addBatchProducts(productsToAdd);
        setBulkText(''); 
        setStatusMsg({type: 'success', text: `تم إضافة ${productsToAdd.length} منتج بنجاح`});
        refreshData();
    } catch (e: any) {
        console.error(e);
        setStatusMsg({type: 'error', text: "حدث خطأ أثناء الإضافة: " + (e.message || "خطأ في الشبكة أو قاعدة البيانات")});
    } finally {
        setIsSubmitting(false);
    }
  };

  const reviewedCount = products.filter(p => !p.is_review_requested && p.price !== null).length;
  const pendingCount = products.filter(p => p.is_review_requested).length;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <OrderSheet 
        isOpen={isOrderSheetOpen} 
        onClose={() => setIsOrderSheetOpen(false)} 
        cart={cart}
        setCart={setCart}
      />

      {/* Header */}
      <div className="bg-slate-800 text-white p-4 sticky top-0 z-20 shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                لوحة التحكم
            </h1>
            <div className="flex gap-2">
                <button 
                  onClick={() => setIsOrderSheetOpen(true)} 
                  className="bg-slate-700 p-2 rounded-lg hover:bg-slate-600 relative"
                  title="سلة الطلبات"
                >
                    <ShoppingCart className="w-5 h-5 text-white" />
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {cart.length}
                        </span>
                    )}
                </button>
                <button 
                  onClick={() => setShowSqlHelp(true)} 
                  className="bg-slate-700 p-2 rounded-lg hover:bg-slate-600 text-emerald-300"
                  title="إصلاح قاعدة البيانات"
                >
                    <Database className="w-5 h-5" />
                </button>
                <button onClick={onLogout} className="bg-slate-700 p-2 rounded-lg hover:bg-slate-600">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-slate-700/50 p-2 rounded text-center">
                <div className="text-2xl font-bold">{pendingCount}</div>
                <div className="text-xs text-slate-300">قيد المراجعة</div>
            </div>
             <div className="bg-slate-700/50 p-2 rounded text-center">
                <div className="text-2xl font-bold">{reviewedCount}</div>
                <div className="text-xs text-slate-300">مكتمل</div>
            </div>
        </div>

        <div className="flex gap-2 mt-4 text-sm">
            <button 
                onClick={() => { setActiveTab('manage'); clearStatus(); }}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'manage' ? 'bg-emerald-500 font-bold' : 'bg-slate-700'}`}
            >
                <FileText className="w-4 h-4" />
                إدارة الأسعار
            </button>
            <button 
                onClick={() => { setActiveTab('add'); clearStatus(); }}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-emerald-500 font-bold' : 'bg-slate-700'}`}
            >
                <PackagePlus className="w-4 h-4" />
                إضافة سلع
            </button>
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMsg && (
          <div className={`p-4 mx-4 mt-4 rounded-lg flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
              {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-bold">{statusMsg.text}</span>
              <button onClick={clearStatus} className="mr-auto p-1 hover:bg-black/10 rounded"><X className="w-4 h-4"/></button>
          </div>
      )}

      {/* SQL Help Modal */}
      {showSqlHelp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
             <div className="flex justify-between items-center mb-4 border-b pb-2">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 <Database className="w-5 h-5 text-emerald-600"/>
                 إصلاح مشاكل قاعدة البيانات
               </h3>
               <button onClick={() => setShowSqlHelp(false)} className="text-gray-500 hover:text-black"><X/></button>
             </div>
             
             <p className="text-sm text-gray-600 mb-3">
               اذا واجهت مشاكل في <b>الحذف</b> أو <b>الإضافة</b>، قم بتشغيل الكود التالي في Supabase SQL Editor:
             </p>

             <div className="bg-slate-900 rounded-lg p-3 mb-4 relative">
                <pre className="text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap text-left dir-ltr max-h-60 overflow-y-auto">
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
             
             <button onClick={() => setShowSqlHelp(false)} className="w-full bg-slate-100 text-slate-700 font-bold py-2 rounded-lg">
               إغلاق
             </button>
           </div>
        </div>
      )}

      {activeTab === 'manage' && (
          <div className="p-4">
             <div className="flex flex-col gap-2 mb-4">
                 <div className="relative w-full">
                     <Search className="absolute right-3 top-3 text-gray-400 w-4 h-4" />
                     <input 
                        className="w-full pl-2 pr-9 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500"
                        placeholder="بحث سريع..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                     />
                 </div>
                 
                 <div className="flex gap-2 w-full">
                    <button 
                        onClick={handleSimpleExport}
                        disabled={isSimpleExporting}
                        className="flex-1 bg-white border border-slate-300 text-slate-700 p-2 rounded-lg shadow-sm active:bg-slate-50 flex items-center justify-center gap-2 text-sm font-bold"
                        title="تنزيل القائمة الحالية"
                    >
                        {isSimpleExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-blue-600" />}
                        قائمة الأسعار
                    </button>
                    <button 
                        onClick={handleBackupExport}
                        disabled={isBackupExporting}
                        className="flex-1 bg-white border border-slate-300 text-slate-700 p-2 rounded-lg shadow-sm active:bg-slate-50 flex items-center justify-center gap-2 text-sm font-bold"
                        title="تنزيل نسخة احتياطية ذكية (تبويبات)"
                    >
                        {isBackupExporting ? <Loader className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4 text-orange-600" />}
                        سجل التعديلات
                    </button>
                 </div>
             </div>

             {selectedIds.size > 0 && (
                 <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-30 flex items-center justify-between animate-in slide-in-from-bottom">
                     <span className="font-bold text-slate-700">{selectedIds.size} عناصر محددة</span>
                     <div className="flex gap-2">
                        <button 
                            onClick={handleBulkDelete}
                            disabled={isDeleting || sending}
                            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold shadow hover:bg-red-200 flex items-center gap-2"
                        >
                            {isDeleting ? '...' : <Trash2 className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={handleSendReview}
                            disabled={sending || isDeleting}
                            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2"
                        >
                            {sending ? 'جاري الارسال...' : 'إرسال للمراجعة'}
                            <Send className="w-4 h-4" />
                        </button>
                     </div>
                 </div>
             )}

             <div className="bg-white rounded-lg shadow overflow-hidden">
                 <div className="p-3 border-b flex items-center gap-3 bg-gray-50">
                     <button onClick={selectAll}>
                         {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                             <CheckSquare className="w-6 h-6 text-emerald-600" />
                         ) : (
                             <Square className="w-6 h-6 text-gray-400" />
                         )}
                     </button>
                     <span className="font-bold text-gray-600">تحديد الكل</span>
                 </div>
                 
                 <div className="divide-y max-h-[60vh] overflow-y-auto">
                     {filteredProducts.map(p => (
                         <div 
                            key={p.id} 
                            className={`flex items-center gap-3 p-3 ${selectedIds.has(p.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'} cursor-pointer group`}
                            onClick={() => toggleSelect(p.id)}
                         >
                             {selectedIds.has(p.id) ? (
                                 <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                             ) : (
                                 <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                             )}
                             <div className="flex-1">
                                 <div className="font-medium text-gray-800">{p.name}</div>
                                 <div className="text-sm text-gray-500">{p.price !== null ? `${Number(p.price).toLocaleString()} جنية` : 'غير مسعر'}</div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                 {p.is_review_requested && (
                                     <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full whitespace-nowrap">قيد المراجعة</span>
                                 )}
                                 
                                 {p.price !== null && (
                                     <button 
                                         onClick={(e) => addToCart(p, e)}
                                         className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                         title="إضافة للسلة"
                                     >
                                         <Plus className="w-5 h-5" />
                                     </button>
                                 )}
                                 
                                 <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSingleDelete(p.id);
                                    }}
                                    className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    title="حذف"
                                 >
                                     <Trash2 className="w-5 h-5" />
                                 </button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
      )}

      {activeTab === 'add' && (
          <div className="p-4 sm:p-6">
              <div className="bg-white rounded-xl shadow p-4 sm:p-6">
                  <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
                      <button 
                        onClick={() => { setAddMode('single'); clearStatus(); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${addMode === 'single' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          منتج واحد
                      </button>
                      <button 
                        onClick={() => { setAddMode('bulk'); clearStatus(); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${addMode === 'bulk' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          قائمة سريعة (Bulk)
                      </button>
                  </div>

                  {addMode === 'single' ? (
                      <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="flex justify-center mb-4">
                              <div className="bg-emerald-100 p-4 rounded-full">
                                  <PackagePlus className="w-8 h-8 text-emerald-600" />
                              </div>
                          </div>
                          <div>
                              <label className="block font-bold text-slate-700 mb-2">اسم المنتج الجديد</label>
                              <input 
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProductName}
                                onChange={e => setNewProductName(e.target.value)}
                                placeholder="مثال: شاي الغزالتين"
                              />
                          </div>
                          <div>
                              <label className="block font-bold text-slate-700 mb-2">السعر المبدئي</label>
                              <input 
                                type="number"
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProductPrice}
                                onChange={e => setNewProductPrice(e.target.value)}
                                placeholder="0"
                              />
                          </div>
                          <button 
                            onClick={handleSingleAdd}
                            disabled={isSubmitting}
                            className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isSubmitting ? (
                                  <>جاري الإضافة...</>
                              ) : (
                                  <>إضافة للقائمة <PackagePlus className="w-4 h-4"/></>
                              )}
                          </button>
                      </div>
                  ) : (
                      <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-2">
                              <p className="font-bold flex items-center gap-2"><ListPlus className="w-4 h-4"/> تعليمات:</p>
                              <p>انسخ القائمة والصقها هنا. النظام سيفصل السعر تلقائياً إذا كان في نهاية السطر ومسبوقاً بمسافة.</p>
                              <p className="mt-1 text-xs opacity-75 dir-ltr text-right font-mono">"سكر 10 كيلو 31000"</p>
                          </div>
                          
                          <textarea 
                            className="w-full h-64 p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm leading-relaxed"
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={`مثال:\nسكر 10 كيلو 31000\nزيت صباح 1 لتر 8000\nعدسية ملوة`}
                          />
                          
                          <button 
                            onClick={handleBulkAdd}
                            disabled={isSubmitting}
                            className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                               {isSubmitting ? (
                                  <>جاري المعالجة...</>
                              ) : (
                                  <>إضافة القائمة كاملة <ListPlus className="w-4 h-4"/></>
                              )}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminPanel;