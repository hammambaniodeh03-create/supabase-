-- =====================================================================
-- Migration: create_profiles
-- الهدف: جدول لحفظ بيانات المستخدم (الاسم، التلفون، الإيميل)
-- بيرتبط مع جدول المستخدمين الداخلي تبع Supabase (auth.users)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) الجدول
-- كل صف = مستخدم واحد. الـ id نفس id المستخدم بـ auth.users
-- on delete cascade: إذا انحذف المستخدم، بينحذف البروفايل تبعه معه
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  first_name  text        not null,
  last_name   text        not null,
  phone       text,
  email       text        not null unique,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'User profile data captured at sign-up.';


-- ---------------------------------------------------------------------
-- 2) الحماية (Row Level Security)
-- بدونها أي حد معه الـ anon key بيقدر يقرأ الجدول كامل.
-- معها: كل مستخدم مسجّل دخول بشوف ويعدّل الصف تبعه بس.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


-- ---------------------------------------------------------------------
-- 3) الدالة: بتنسخ بيانات المستخدم الجديد على جدول profiles
-- الفرونت اند ببعت الاسم والتلفون كـ metadata مع طلب الكود،
-- وهاي الدالة بتطلّعهم من raw_user_meta_data وبتحطهم بالجدول.
-- security definer: بتشتغل بصلاحيات صاحب الدالة عشان تقدر تكتب بالجدول
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 4) الـ Trigger: أول ما ينضاف مستخدم على auth.users، شغّل الدالة
-- ---------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
