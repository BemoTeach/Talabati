import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rubilnmhqakjsyzscqve.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EwfNFzxuh63XSmfEJy2aRQ_kx-EnaIa';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
