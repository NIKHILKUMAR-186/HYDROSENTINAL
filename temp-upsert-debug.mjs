import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
console.log('URL:', url);
console.log('KEY:', key ? key.slice(0,20) + '...' : 'undefined');
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(url, key);
(async () => {
  try {
    const payload = {
      id: 'test-upsert-debug-001',
      email: 'test-upsert@example.com',
      full_name: 'Test Upsert',
      username: 'testupsert001',
      profile_completion: 0,
      role: 'user',
      is_active: true,
    };
    console.log('payload', payload);
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id', returning: 'representation' })
      .select()
      .single();
    console.log('data', data);
    console.log('error', error);
    if (error) {
      console.error('ERROR OBJECT:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('THROWN:', err);
    process.exit(2);
  }
})();
