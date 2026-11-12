// Supabase project settings (Dashboard → Project Settings → API).
// The anon / publishable key is safe in the browser: Row Level Security
// protects the data. NEVER put the service_role / secret key here.
window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-ID.supabase.co",
  anonKey: "YOUR-ANON-OR-PUBLISHABLE-KEY",
  otpLength: 6, // must match Authentication → Providers → Email → "Email OTP Length"
};
