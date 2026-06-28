import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('./.env', 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (!key) return acc;
    let value = rest.join('=');
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    acc[key.trim()] = value;
    return acc;
  }, {});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
console.log('VITE_SUPABASE_URL=', url);
console.log('VITE_SUPABASE_PUBLISHABLE_KEY=', key ? key.slice(0, 30) + '...' : 'undefined');
if (!url || !key) {
  console.error('Missing required Supabase env vars');
  process.exit(1);
}

const supabase = createClient(url, key);
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

try {
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
  console.error('THROWN ERROR:', err);
  process.exit(2);
}
