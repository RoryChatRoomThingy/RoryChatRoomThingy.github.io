window.APP_CONFIG = {
  supabaseUrl: 'https://tlrhtmjqwtvxhotqfkih.supabase.co',
  supabaseKey: 'sb_publishable_Oa2-wClTjbdHTucXZo0vuA_qAuuHCd4'
};

window.supabaseClient = window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseKey);
