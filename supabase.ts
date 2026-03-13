import { createClient } from '@supabase/supabase-js';

// 优先使用运行时配置，回退到构建时环境变量
const supabaseUrl = (window as any).__APP_CONFIG__?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = (window as any).__APP_CONFIG__?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
