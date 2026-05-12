import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
export const ADMIN_EMAIL = import.meta.env.PUBLIC_ADMIN_EMAIL as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
