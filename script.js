const { url, anonKey, otpLength = 6 } = window.SUPABASE_CONFIG;
const db = window.supabase.createClient(url, anonKey);

// ---------- elements ----------
const detailsForm = document.getElementById("details-form");
const otpForm = document.getElementById("otp-form");
const otpBoxes = document.getElementById("otp-boxes");
const resendBtn = document.getElementById("resend-btn");
const backBtn = document.getElementById("back-btn");

let userData = null; // { firstName, lastName, phone, email }

// ---------- helpers ----------
function showStep(n) {
  const panels = ["step-details", "step-otp", "step-success"];
  panels.forEach((id, i) => document.getElementById(id).classList.toggle("is-visible", i === n - 1));
  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("is-active", s === n);
    el.classList.toggle("is-done", s < n);
  });
}

function setLoading(form, loading) {
  const btn = form.querySelector(".btn");
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
}

function setMessage(form, text, info = false) {
  const el = form.querySelector(".form-message");
  el.textContent = text;
  el.classList.toggle("is-info", info);
}

// ---------- step 1: validate + send code ----------
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
    if (error) ok = false;
    data[name] = value;
  }
  return ok ? data : null;
}

async function sendCode() {
  // Creates the user (if new) and emails a one-time code.
  // `data` is saved as user metadata; the DB trigger copies it into public.profiles.
  return db.auth.signInWithOtp({
    email: userData.email,
    options: {
      shouldCreateUser: true,
      data: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone,
      },
    },
  });
}

detailsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage(detailsForm, "");
  const data = validate(detailsForm);
  if (!data) return;

  userData = data;
  setLoading(detailsForm, true);
  const { error } = await sendCode();
  setLoading(detailsForm, false);

  if (error) {
    setMessage(detailsForm, error.message);
    return;
  }

  document.getElementById("sent-to").textContent = userData.email;
  buildOtpBoxes();
  showStep(2);
  otpBoxes.querySelector("input").focus();
  startResendCooldown();
});

// ---------- step 2: OTP boxes ----------
function buildOtpBoxes() {
  otpBoxes.innerHTML = "";
  otpBoxes.className = "otp";
  for (let i = 0; i < otpLength; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = i === 0 ? "one-time-code" : "off";
    input.setAttribute("aria-label", `Digit ${i + 1}`);
    otpBoxes.appendChild(input);
  }
}

function boxes() {
  return [...otpBoxes.querySelectorAll("input")];
}

function fillBox(input, digit) {
  input.value = digit;
  input.classList.remove("is-filled");
  if (digit) {
    void input.offsetWidth; // restart the pop animation
    input.classList.add("is-filled");
  }
}

otpBoxes.addEventListener("input", (e) => {
  const input = e.target;
  const all = boxes();
  // Typing into a filled box replaces its digit; paste/autofill brings the full code
  const raw = e.inputType === "insertText" && e.data ? e.data : input.value;
  const digits = raw.replace(/\D/g, "");
  otpBoxes.classList.remove("is-error");

  // Handles typing one digit and pasting/autofilling the whole code
  let i = all.indexOf(input);
  if (!digits) return fillBox(input, "");
  for (const d of digits) {
    if (i >= all.length) break;
    fillBox(all[i], d);
    i++;
  }
  (all[i] || all[all.length - 1]).focus();

  if (all.every((b) => b.value)) otpForm.requestSubmit();
});

otpBoxes.addEventListener("keydown", (e) => {
  const all = boxes();
  const i = all.indexOf(e.target);
  if (e.key === "Backspace" && !e.target.value && i > 0) {
    fillBox(all[i - 1], "");
    all[i - 1].focus();
    e.preventDefault();
  } else if (e.key === "ArrowLeft" && i > 0) all[i - 1].focus();
  else if (e.key === "ArrowRight" && i < all.length - 1) all[i + 1].focus();
});

otpBoxes.addEventListener("focusin", (e) => e.target.select());

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (otpForm.querySelector(".btn").disabled) return;
  const token = boxes().map((b) => b.value).join("");

  if (token.length !== otpLength) {
    setMessage(otpForm, `Please enter all ${otpLength} digits.`);
    otpBoxes.classList.add("is-error");
    return;
  }

  setMessage(otpForm, "");
  setLoading(otpForm, true);
  const { error } = await db.auth.verifyOtp({ email: userData.email, token, type: "email" });
  setLoading(otpForm, false);

  if (error) {
    setMessage(otpForm, "That code is incorrect or expired. Try again.");
    otpBoxes.classList.remove("is-error");
    void otpBoxes.offsetWidth; // restart the shake animation
    otpBoxes.classList.add("is-error");
    boxes().forEach((b) => fillBox(b, ""));
    boxes()[0].focus();
    return;
  }

  otpBoxes.classList.add("is-success");
  document.getElementById("welcome-name").textContent = userData.firstName;
  setTimeout(() => showStep(3), 600);
});

// ---------- resend / back ----------
let cooldownTimer;
function startResendCooldown(seconds = 60) {
  clearInterval(cooldownTimer);
  resendBtn.disabled = true;
  let left = seconds;
  resendBtn.textContent = `Resend code (${left}s)`;
  cooldownTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(cooldownTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend code";
    } else {
      resendBtn.textContent = `Resend code (${left}s)`;
    }
  }, 1000);
}

resendBtn.addEventListener("click", async () => {
  resendBtn.disabled = true;
  const { error } = await sendCode();
  if (error) {
    setMessage(otpForm, error.message);
    resendBtn.disabled = false;
    return;
  }
  setMessage(otpForm, "A new code is on its way.", true);
  startResendCooldown();
});

backBtn.addEventListener("click", () => {
  clearInterval(cooldownTimer);
  setMessage(otpForm, "");
  showStep(1);
});
