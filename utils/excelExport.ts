import { Product } from "../types";
import { fetchFullPriceHistory } from "../services/productService";

// 1. تصدير القائمة الحالية فقط (اسم وسعر) - خيار بسيط
export const exportCurrentList = (products: Product[]) => {
  if (!window.XLSX) {
    alert("Excel library not loaded. Please refresh.");
    return;
  }

  // تجهيز البيانات: الاسم والسعر فقط
  const data = products.map(p => ({
    "اسم_المنتج": p.name,
    "السعر_الحالي": p.price
  }));

  const worksheet = window.XLSX.utils.json_to_sheet(data);
  const workbook = window.XLSX.utils.book_new();

  // تنسيق عرض الأعمدة
  const wscols = [
    { wch: 40 }, // Product Name
    { wch: 20 }, // Price
  ];
  worksheet['!cols'] = wscols;

  window.XLSX.utils.book_append_sheet(workbook, worksheet, "الاسعار_الحالية");
  
  const date = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(workbook, `قائمة_الاسعار_${date}.xlsx`);
};

// 2. تصدير النسخة الاحتياطية الذكية (شاملة الكل + سجلات التواريخ)
export const exportHistoryTabs = async (products: Product[]) => {
  if (!window.XLSX) {
    alert("Excel library not loaded. Please refresh.");
    return;
  }

  // جلب السجل الكامل
  let historyData: any[] = [];
  try {
      historyData = await fetchFullPriceHistory();
  } catch (e) {
      console.log("History fetch failed, proceeding with main list only");
  }

  const workbook = window.XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0, 10);
  
  // --- الصفحة الأولى: القائمة الشاملة (كل المنتجات) ---
  // تشمل: الاسم، السعر الحالي، تاريخ آخر تحديث
  const mainListData = products.map(p => {
      let lastUpdateDate = "";
      if (p.last_updated) {
          // Format ISO date to YYYY-MM-DD
          lastUpdateDate = p.last_updated.split('T')[0];
      }
      
      return {
          "اسم_المنتج": p.name,
          "السعر_الحالي": p.price !== null ? p.price : "غير مسعر",
          "تاريخ_آخر_تحديث": lastUpdateDate || "قديم"
      };
  });

  const mainWorksheet = window.XLSX.utils.json_to_sheet(mainListData);
  mainWorksheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
  window.XLSX.utils.book_append_sheet(workbook, mainWorksheet, "القائمة_الرئيسية_الشاملة");

  // --- الصفحات التالية: تبويبات لكل تاريخ (للمنتجات المعدلة فقط) ---
  
  // تجميع التواريخ الفريدة من السجل
  let uniqueDates = Array.from(new Set(historyData.map(h => h.recorded_date))).sort().reverse(); // الأحدث أولاً

  // إنشاء خريطة للبحث عن أسماء المنتجات بسرعة
  const productMap = new Map(products.map(p => [p.id, p.name]));

  // إنشاء تبويب (Sheet) لكل تاريخ يحتوي على تعديلات
  uniqueDates.forEach(date => {
      // فلترة السجلات الخاصة بهذا التاريخ فقط
      const recordsForDate = historyData.filter(h => h.recorded_date === date);
      
      if (recordsForDate.length > 0) {
          // تجهيز بيانات هذا التبويب
          const sheetData = recordsForDate.map(record => ({
              "اسم_المنتج": productMap.get(record.product_id) || "منتج محذوف",
              "السعر_في_هذا_التاريخ": record.price
          }));

          const worksheet = window.XLSX.utils.json_to_sheet(sheetData);
          
          // تنسيق الأعمدة
          worksheet['!cols'] = [{ wch: 40 }, { wch: 20 }];

          // إضافة التبويب للملف باسم التاريخ
          // Ensure sheet name is safe (Excel limit 31 chars, no special chars)
          const safeSheetName = date.replace(/[\/\\\?\*\[\]]/g, '-').substring(0, 31);
          
          window.XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      }
  });

  window.XLSX.writeFile(workbook, `نسخة_احتياطية_شاملة_${today}.xlsx`);
};