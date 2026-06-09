const SUPABASE_URL = 'https://jlkhhqgzsqsuuaqfrytu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsa2hocWd6c3FzdXVhcWZyeXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mzk5NzYsImV4cCI6MjA5NjIxNTk3Nn0.eat_1M4IO57irq38yP6Q0JBDvIUBmBWXYMBPNZ8gDvw';

// Supabase v2 — window.supabase се зарежда от CDN
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
