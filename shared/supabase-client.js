// shared/supabase-client.js
// Singleton — importé par toutes les pages du site (app.js, nav.js, stats.js, etc.)
// Le garde `window.supabaseClient` empêche la création de plusieurs GoTrueClient
// si plusieurs scripts créaient chacun leur propre createClient().

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vvizvjmvesjenuetsxyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6vv-OVHoOw2xCbKTbEOp8g_nRqdP7wc';

if (!window.supabaseClient) {
  window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const supabase = window.supabaseClient;

