import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://etubpowlffhdvnfqkjij.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_AyehSGHv6TEwFvPQIuMivg_-_mJ7zUH';
export const ADMIN_EMAIL = 'clairevigneron.contact@gmail.com';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
