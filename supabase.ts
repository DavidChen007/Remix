import { createClient } from '@supabase/supabase-js';

// 使用函数来延迟读取配置，确保 config.js 已加载
function getSupabaseConfig() {
  const supabaseUrl = (window as any).__APP_CONFIG__?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (window as any).__APP_CONFIG__?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  return {
    url: supabaseUrl || 'https://placeholder.supabase.co',
    key: supabaseAnonKey || 'placeholder'
  };
}

// 延迟初始化 Supabase 客户端
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    if (!supabaseInstance) {
      const config = getSupabaseConfig();
      supabaseInstance = createClient(config.url, config.key);
    }
    return (supabaseInstance as any)[prop];
  }
});
