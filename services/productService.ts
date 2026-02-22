import { supabase } from '../supabaseClient';
import { Product, Order, CartItem, PriceHistory } from '../types';
import { parseInitialData } from '../constants';

const TABLE_NAME = 'products';
const ORDERS_TABLE = 'orders';
const HISTORY_TABLE = 'price_history';

// Robust ID Generator (Polyfill for environments without secure crypto)
const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback if it fails
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper to sanitize price
const sanitizePrice = (price: number | string | null | undefined): number | null => {
    if (price === null || price === undefined) return null;
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
        if (price.trim() === '') return null;
        // Remove commas, keep dots for decimals if needed, but usually price is integer
        const cleanStr = price.replace(/,/g, '').trim();
        const num = Number(cleanStr);
        return isNaN(num) ? null : num;
    }
    return null;
};

// Check and seed data if empty
export const initializeData = async (): Promise<void> => {
  try {
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error checking DB:", error);
        return;
    }

    if (count === 0) {
      console.log("Database empty, seeding initial data...");
      const rawProducts = parseInitialData();
      
      const initialProducts = rawProducts.map(p => ({
          id: generateId(),
          ...p,
          price: sanitizePrice(p.price),
          last_updated: new Date().toISOString(),
          is_review_requested: false,
          review_batch_id: null
      }));
      
      const chunkSize = 50;
      for (let i = 0; i < initialProducts.length; i += chunkSize) {
        const chunk = initialProducts.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from(TABLE_NAME).insert(chunk);
        if (insertError) console.error("Seeding chunk error:", insertError);
      }
      console.log("Seeding complete.");
    }
  } catch (err) {
    console.error("Initialization error:", err);
  }
};

export const fetchProducts = async (): Promise<Product[]> => {
  // Add a timeout signal
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('name', { ascending: true })
    .abortSignal(AbortSignal.timeout(10000)); // 10s timeout

  if (error) throw error;
  return data as Product[];
};

export const updateProductPrice = async (id: string, price: number | string): Promise<void> => {
  const finalPrice = sanitizePrice(price);
  
  // 1. Update the product current price
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ 
        price: finalPrice, 
        last_updated: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) throw error;

  // 2. Insert into History (Upsert logic to prevent duplicates per day)
  if (finalPrice !== null) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const { error: historyError } = await supabase
        .from(HISTORY_TABLE)
        .upsert({
            product_id: id,
            price: finalPrice,
            recorded_date: today
        }, { onConflict: 'product_id, recorded_date' });
      
      if (historyError) console.error("History Error:", historyError);
  }
};

export const addProduct = async (name: string, price: number | string): Promise<Product | null> => {
    const finalPrice = sanitizePrice(price);
    const newId = generateId();

    const payload = { 
        id: newId,
        name: name.trim(), 
        price: finalPrice,
        is_review_requested: false,
        review_batch_id: null,
        last_updated: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([payload])
      .select()
      .single();
    
    if (error) throw error;

    // Add initial history
    if (finalPrice !== null) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from(HISTORY_TABLE).insert({
            product_id: newId,
            price: finalPrice,
            recorded_date: today
        });
    }

    return data;
};

export const addBatchProducts = async (products: {name: string, price: number | string | null}[]): Promise<void> => {
    const finalProducts = products.map(p => ({
        id: generateId(),
        name: p.name.trim(),
        price: sanitizePrice(p.price),
        is_review_requested: false,
        review_batch_id: null,
        last_updated: new Date().toISOString()
    }));

    // Chunking for main insert
    const chunkSize = 50;
    for (let i = 0; i < finalProducts.length; i += chunkSize) {
        const chunk = finalProducts.slice(i, i + chunkSize);
        const { error } = await supabase.from(TABLE_NAME).insert(chunk);
        if (error) throw error;
    }

    // Insert history for priced items
    const today = new Date().toISOString().slice(0, 10);
    const historyItems = finalProducts
        .filter(p => p.price !== null)
        .map(p => ({
            product_id: p.id,
            price: p.price,
            recorded_date: today
        }));
    
    if (historyItems.length > 0) {
        for (let i = 0; i < historyItems.length; i += chunkSize) {
            const chunk = historyItems.slice(i, i + chunkSize);
             await supabase.from(HISTORY_TABLE).upsert(chunk, {onConflict: 'product_id, recorded_date'});
        }
    }
};

export const deleteProducts = async (ids: string[]): Promise<void> => {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .in('id', ids);

    if (error) throw error;
};

export const requestReview = async (productIds: string[], batchId: string): Promise<void> => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ 
            is_review_requested: true,
            review_batch_id: batchId
        })
        .in('id', productIds);
    
    if (error) throw error;
};

export const completeReview = async (productId: string): Promise<void> => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ 
            is_review_requested: false,
            review_batch_id: null
        })
        .eq('id', productId);
    
    if (error) throw error;
};

// --- History Logic ---
export const fetchFullPriceHistory = async (): Promise<PriceHistory[]> => {
    const { data, error } = await supabase
        .from(HISTORY_TABLE)
        .select('*');
    if (error) {
        console.warn("Could not fetch history (table might not exist yet):", error);
        return [];
    }
    return data as PriceHistory[];
};

// --- Orders Logic ---

export const fetchOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from(ORDERS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Order[];
};

export const saveOrder = async (order: {name: string, items: CartItem[], profit_margin: number, delivery_cost?: number, total_price: number}): Promise<Order | null> => {
    const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .insert([{
            id: generateId(),
            ...order,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();
    
    if (error) throw error;
    return data;
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<void> => {
    const { error } = await supabase
        .from(ORDERS_TABLE)
        .update(updates)
        .eq('id', id);
    
    if (error) throw error;
};

export const deleteOrder = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from(ORDERS_TABLE)
        .delete()
        .eq('id', id);
    
    if (error) throw error;
};