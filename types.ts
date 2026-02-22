export interface Product {
    id: string; // UUID
    name: string;
    price: number | string | null; // Allow null for DB compatibility
    last_updated?: string;
    is_review_requested?: boolean;
    review_batch_id?: string | null;
  }
  
  export interface ReviewRequest {
    batchId: string;
    count: number;
    timestamp: string;
  }
  
  export interface CartItem {
    productId: string;
    name: string;
    originalPrice: number;
    quantity: number;
    customPrice?: number; // If user overrides price manually
    itemProfit?: number; // Individual profit percentage override
  }

  export interface Order {
    id: string;
    name: string;
    items: CartItem[]; // Stored as JSONB
    profit_margin: number;
    delivery_cost?: number; // Added delivery cost
    total_price: number;
    created_at: string;
  }

  export interface PriceHistory {
    id: string;
    product_id: string;
    price: number;
    recorded_date: string; // YYYY-MM-DD
  }
  
  // SheetJS Global Type Declaration
  declare global {
    interface Window {
      XLSX: any;
    }
  }