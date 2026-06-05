# Дюнер Мастър – Supabase Setup

## 1. Създай Supabase проект
1. Отиди на https://supabase.com → Create new project
2. Напиши: Project name: `duner-master`, избери парола, Region: EU West

## 2. Създай таблицата orders
В Supabase Dashboard → SQL Editor → New Query → постави и изпълни:

```sql
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  text NOT NULL,
  name          text NOT NULL,
  phone         text NOT NULL,
  address       text,
  delivery_type text NOT NULL DEFAULT 'pickup',
  pickup_time   text,
  items         jsonb NOT NULL DEFAULT '[]',
  total         numeric(10,2) NOT NULL,
  status        text NOT NULL DEFAULT 'new',
  note          text,
  created_at    timestamptz DEFAULT now()
);

-- RLS: Enable
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public can only INSERT
CREATE POLICY "public_insert" ON orders
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (admin) can do everything
CREATE POLICY "admin_all" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 3. Създай admin потребител
Supabase Dashboard → Authentication → Users → Add User
- Email: твоя email
- Password: силна парола

## 4. Попълни supabaseClient.js
Supabase Dashboard → Settings → API:
- Project URL → замени `https://ТВОЯ_ПРОЕКТ.supabase.co`
- anon public key → замени `ТВОЯ_ANON_KEY`

## 5. Качи на GitHub Pages
Качи всички файлове в репото. Сайтът работи на GitHub Pages.

## Файлова структура
```
/index.html      ← клиентски сайт
/admin.html      ← админ панел (отвори на касата)
/app.js          ← логика на поръчките
/admin.js        ← логика на админа
/supabaseClient.js ← Supabase конфигурация
/styles.css      ← стилове
```

## Достъп до Admin
Отвори: `твоя-сайт.github.io/admin.html`
Влез с email и парола от стъпка 3.
