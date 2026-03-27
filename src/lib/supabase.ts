import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iwkbercykwyaxxirhrbr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_echswqy2rOrCF1bn49a49w__SvLJtw7';

export const supabase = createClient(supabaseUrl, supabaseKey);
