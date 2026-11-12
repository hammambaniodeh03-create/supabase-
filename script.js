const { url, anonKey } = window.SUPABASE_CONFIG;
const db = window.supabase.createClient(url, anonKey);

// ---------- elements ----------
const detailsForm = document.getElementById("details-form");

// ---------- helpers ----------
function showStep(n) {
  const panels = ["step-details", "step-success"];
  panels.forEach((id, i) => document.getElementById(id).classList.toggle("is-visible", i === n - 1));
  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("is-active", s === n);
    el.classList.toggle("is-done", s < n);
    if (s === n) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
}

function setLoading(form, loading) {
  const btn = form.querySelector(".btn");
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
}

function setMessage(form, text) {
  form.querySelector(".form-message").textContent = text;
}

// ---------- validation ----------
const rules = {
  firstName: (v) => (v.length >= 2 ? "" : "Please enter your first name."),
  lastName: (v) => (v.length >= 2 ? "" : "Please enter your last name."),
  phone: (v) => (/^\+?[0-9\s-]{7,15}$/.test(v) ? "" : "Please enter a valid phone number."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Please enter a valid email."),
};

function validate(form) {
  let ok = true;
  const data = {};
  for (const [name, check] of Object.entries(rules)) {
    const input = form.elements[name];
    const value = input.value.trim();
    const error = check(value);
    input.closest(".field").classList.toggle("has-error", !!error);
    input.closest(".field").querySelector(".error").textContent = error;
    input.setAttribute("aria-invalid", error ? "true" : "false");
    if (error) ok = false;
    data[name] = value;
  }
  return ok ? data : null;
}

// ---------- submit: save to public.signups ----------
detailsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage(detailsForm, "");
  const data = validate(detailsForm);
  if (!data) return;

  setLoading(detailsForm, true);
  const { error } = await db.from("signups").insert({
    first_name: data.firstName,
    last_name: data.lastName,
    phone: data.phone,
    email: data.email.toLowerCase(),
  });
  setLoading(detailsForm, false);

  if (error) {
    // 23505 = unique violation → this email already exists in the table
    setMessage(
      detailsForm,
      error.code === "23505" ? "This email is already registered." : error.message
    );
    return;
  }

  document.getElementById("welcome-name").textContent = data.firstName;
  showStep(2);
});
