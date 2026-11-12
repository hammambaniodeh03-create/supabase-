-- =====================================================================
-- Migration: create_signups
-- الهدف: جدول بسيط بيحفظ بيانات كل واحد بيسجّل من الفورم
-- (بدون تسجيل دخول وبدون كود تحقق)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) الجدول
-- كل صف = تسجيل واحد. الـ id بيتولّد تلقائياً.
-- الإيميل unique: ما بينفع نفس الإيميل يسجّل مرتين.
-- ---------------------------------------------------------------------
create table public.signups (
  id          uuid        primary key default gen_random_uuid(),
  first_name  text        not null check (char_length(first_name) between 1 and 100),
  last_name   text        not null check (char_length(last_name)  between 1 and 100),
  phone       text        not null check (char_length(phone)      between 1 and 30),
  email       text        not null unique check (char_length(email) between 3 and 254),
  created_at  timestamptz not null default now()
);

comment on table public.signups is 'People who signed up through the sign-up form.';


-- ---------------------------------------------------------------------
-- 2) الحماية (Row Level Security)
-- الصفحة بتستخدم الـ anon key، فلازم نحدد شو مسموح إلها بالزبط:
--   - مسموح: إضافة صف جديد (insert)
--   - ممنوع: قراءة أو تعديل أو حذف أي صف
-- يعني ما حدا بيقدر يشوف بيانات المسجّلين من المتصفح،
-- إنت بتشوفها بس من لوحة Supabase (Table Editor).
-- ---------------------------------------------------------------------
alter table public.signups enable row level security;

grant insert on public.signups to anon, authenticated;

create policy "Anyone can sign up"
  on public.signups
  for insert
  to anon, authenticated
  with check (true);
