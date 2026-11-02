import React, { useState, useEffect, useRef } from "react";
import QRCode from "./qr.js";
import "./App.css";

/* ---------- tiny router (replaces react-router-dom) ---------- */
const NavContext = React.createContext(() => {});
const BackContext = React.createContext(() => {});
const PathContext = React.createContext("/");
const useBack = () => React.useContext(BackContext);
const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
const tabPath = (n) => (n === "Overview" ? "/dashboard" : "/dashboard/" + slug(n));
const tabFromPath = (path, list) => list.find((n) => tabPath(n) === path) || "Overview";

function PageNav({ onBack }) {
  const back = useBack();
  const go = React.useContext(NavContext);
  return (
    <div className="pagenav">
      <button type="button" className="pn-btn" onClick={onBack || back}>← Back</button>
      <button type="button" className="pn-btn" onClick={() => go("/")}>⌂ Home</button>
    </div>
  );
}
const useNavigate = () => React.useContext(NavContext);
function Link({ to, className, children }) {
  const go = React.useContext(NavContext);
  return (
    <a href={"#" + to} className={className} onClick={(e) => { e.preventDefault(); go(to); }}>
      {children}
    </a>
  );
}

/* ---------- auth (mock; works even if localStorage is blocked) ---------- */
const mem = {};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
  del: (k) => { try { localStorage.removeItem(k); } catch { delete mem[k]; } },
};
const KEY = "wt_user";
const getUser = () => { try { return JSON.parse(store.get(KEY)); } catch { return null; } };
const isLoggedIn = () => Boolean(getUser());
/* Demo only: a real app hashes passwords on the server, never in the browser. */
const ACC = "wt_accounts";
const getAccounts = () => { try { return JSON.parse(store.get(ACC)) || {}; } catch { return {}; } };
const saveAccounts = (a) => store.set(ACC, JSON.stringify(a));
const hash = async (text) => {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch { return "plain:" + text; }
};
const niceName = (email) => { const n = email.split("@")[0].replace(/[._]/g, " "); return n.charAt(0).toUpperCase() + n.slice(1); };
const login = async (email, password, role) => {
  await new Promise((r) => setTimeout(r, 800));
  const acc = getAccounts()[email.toLowerCase()];
  if (acc) {
    if (acc.password !== (await hash(password))) throw new Error("Incorrect email or password. Try again.");
    if (acc.role && acc.role !== role)
      throw new Error(`This email is registered as ${acc.role === "employee" ? "an Employee" : "a Management"} account. Switch the role above.`);
  } else if (password.length < 6) {
    throw new Error("Incorrect email or password. Try again.");
  }
  const user = { email, role, name: (acc && acc.name) || niceName(email) };
  store.set(KEY, JSON.stringify(user));
  return user;
};
const register = async (name, email, password, role) => {
  await new Promise((r) => setTimeout(r, 800));
  const all = getAccounts();
  const key = email.toLowerCase();
  if (all[key]) throw new Error("An account with this email already exists. Try signing in.");
  all[key] = { name, role, password: await hash(password) };
  saveAccounts(all);
  const user = { email, role, name };
  store.set(KEY, JSON.stringify(user));
  return user;
};
const resetPassword = async (email, password) => {
  await new Promise((r) => setTimeout(r, 600));
  const all = getAccounts();
  const key = email.toLowerCase();
  all[key] = { ...(all[key] || {}), password: await hash(password) };
  saveAccounts(all);
};
const logout = () => store.del(KEY);

/* ---------- components ---------- */
function AuthLayout({ title, subtitle, children, onBack }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand">
          <span className="brand-mark" />
          Wellness Tracker
        </div>

        <div className="breath" aria-hidden="true">
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="ring r3" />
        </div>

        <div className="auth-copy">
          <h2>Work well. Rest well.</h2>
          <p>
            Track your focus, check in on your mood and catch burnout early,
            all in one calm place.
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <PageNav onBack={onBack} />
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

/* ---------- pages ---------- */

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("employee");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  };

  const validate = () => {
    const err = {};
    if (!form.email.trim()) err.email = "Enter your work email.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      err.email = "Enter a valid email, like name@company.com.";
    if (!form.password) err.password = "Enter your password.";
    else if (form.password.length < 6)
      err.password = "Password must be at least 6 characters.";
    return err;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length) return setErrors(err);

    try {
      setLoading(true);
      await login(form.email, form.password, role);
      navigate("/dashboard");
    } catch (ex) {
      setServerError(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={role === "employee" ? "Sign in to see how your week is going." : "Sign in to see how your team is doing this week."}
    >
      <div className="role-switch" role="radiogroup" aria-label="Sign in as">
        {[["employee", "Employee"], ["management", "Management"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={role === id}
            className={role === id ? "on" : ""}
            onClick={() => setRole(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert" role="alert">{serverError}</div>}

        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={form.email}
            onChange={handleChange}
            className={errors.email ? "invalid" : ""}
          />
          {errors.email && <span className="err">{errors.email}</span>}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="pw">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              className={errors.password ? "invalid" : ""}
            />
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <span className="err">{errors.password}</span>}
        </div>

        <div className="row">
          <label className="check">
            <input type="checkbox" /> Keep me signed in
          </label>
          <Link to="/forgot-password" className="link">Forgot password?</Link>
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : `Sign in as ${role === "employee" ? "Employee" : "Manager"}`}
        </button>
        <p className="center">New here? <Link to="/register" className="link">Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}


const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const pwScore = (p) => {
  let n = 0;
  if (p.length >= 8) n++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n++;
  if (/\d/.test(p)) n++;
  if (/[^A-Za-z0-9]/.test(p)) n++;
  return n;
};
const pwLabel = ["Too weak", "Weak", "Okay", "Good", "Strong"];
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function RoleSwitch({ role, setRole }) {
  return (
    <div className="role-switch" role="radiogroup" aria-label="Account type">
      {[["employee", "Employee"], ["management", "Management"]].map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={role === id} className={role === id ? "on" : ""} onClick={() => setRole(id)}>{label}</button>
      ))}
    </div>
  );
}

function PasswordStrength({ value }) {
  if (!value) return null;
  const sc = pwScore(value);
  return (
    <div className="strength-wrap">
      <div className="strength"><i className={`s${sc}`} style={{ width: `${(sc / 4) * 100}%` }} /></div>
      <span className="small muted">{pwLabel[sc]}</span>
    </div>
  );
}

function OtpInput({ digits, setDigits, invalid }) {
  const refs = useRef([]);
  useEffect(() => { refs.current[0] && refs.current[0].focus(); }, []);
  const change = (i, e) => {
    const v = e.target.value.replace(/\D/g, "");
    const next = [...digits];
    next[i] = v.slice(-1);
    setDigits(next);
    if (v && i < 5) refs.current[i + 1].focus();
  };
  const keyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1].focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1].focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1].focus();
  };
  const paste = (e) => {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!t) return;
    e.preventDefault();
    const next = Array(6).fill("");
    t.split("").forEach((c, i) => (next[i] = c));
    setDigits(next);
    refs.current[Math.min(t.length, 5)].focus();
  };
  return (
    <div className="otp" onPaste={paste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={invalid ? "invalid" : ""}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          onChange={(e) => change(i, e)}
          onKeyDown={(e) => keyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [attempts, setAttempts] = useState(0);
  const [left, setLeft] = useState(300);
  const [cooldown, setCooldown] = useState(0);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const locked = attempts >= 3;

  useEffect(() => {
    if (step !== "otp") return;
    const t = setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const issueCode = () => {
    setCode(makeOtp());
    setDigits(Array(6).fill(""));
    setAttempts(0);
    setLeft(300);
    setCooldown(30);
    setError("");
  };

  const sendCode = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email, like name@company.com.");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    issueCode();
    setInfo("");
    setStep("otp");
  };

  const resend = () => {
    if (cooldown > 0) return;
    issueCode();
    setInfo("A new code was sent.");
  };

  const verify = (e) => {
    e.preventDefault();
    setInfo("");
    if (locked) return setError("Too many wrong attempts. Request a new code.");
    if (left === 0) return setError("This code has expired. Request a new one.");
    const entered = digits.join("");
    if (entered.length < 6) return setError("Enter all 6 digits.");
    if (entered !== code) {
      const n = attempts + 1;
      setAttempts(n);
      setDigits(Array(6).fill(""));
      return setError(n >= 3 ? "Too many wrong attempts. Request a new code." : `Incorrect code. ${3 - n} ${3 - n === 1 ? "try" : "tries"} left.`);
    }
    setError("");
    setStep("reset");
  };

  const reset = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    setLoading(true);
    await resetPassword(email, pw);
    setLoading(false);
    setError("");
    setStep("done");
  };

  if (step === "done")
    return (
      <AuthLayout title="Password updated" subtitle="You can now sign in with your new password." onBack={() => navigate("/login")}>
        <button className="btn" onClick={() => navigate("/login")}>Go to sign in</button>
      </AuthLayout>
    );

  if (step === "reset")
    return (
      <AuthLayout title="Set a new password" subtitle={`Choose a new password for ${email}.`} onBack={() => { setStep("otp"); setError(""); }}>
        <form onSubmit={reset} noValidate>
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="npw">New password</label>
            <div className="pw">
              <input id="npw" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} placeholder="At least 8 characters" />
              <button type="button" className="link-btn" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
            </div>
            <PasswordStrength value={pw} />
          </div>
          <div className="field">
            <label htmlFor="npw2">Confirm password</label>
            <input id="npw2" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(""); }} placeholder="Type it again" />
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? "Saving…" : "Update password"}</button>
        </form>
      </AuthLayout>
    );

  if (step === "otp")
    return (
      <AuthLayout title="Enter the 6-digit code" subtitle={`We sent a code to ${email}.`} onBack={() => { setStep("email"); setError(""); setInfo(""); }}>
        <form onSubmit={verify} noValidate>
          <div className="demo-note">Demo mode: no email is sent. Your code is <b>{code}</b>.</div>
          {error && <div className="alert" role="alert">{error}</div>}
          {info && !error && <div className="ok" role="status">{info}</div>}
          <OtpInput key={code} digits={digits} setDigits={(d) => { setDigits(d); setError(""); }} invalid={Boolean(error)} />
          <p className="small muted otp-time">{left > 0 ? `Code expires in ${mmss(left)}` : "Code expired"}</p>
          <button className="btn" type="submit" disabled={locked || left === 0}>Verify code</button>
          <p className="center small">
            Didn't get it?{" "}
            <button type="button" className="link-btn" onClick={resend} disabled={cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </p>
          <p className="center">
            <button type="button" className="link-btn" onClick={() => { setStep("email"); setError(""); setInfo(""); }}>Use a different email</button>
          </p>
        </form>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your work email and we'll send you a 6-digit code.">
      <form onSubmit={sendCode} noValidate>
        <div className="field">
          <label htmlFor="femail">Work email</label>
          <input id="femail" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={error ? "invalid" : ""} />
          {error && <span className="err">{error}</span>}
        </div>
        <button className="btn" type="submit" disabled={loading}>{loading ? "Sending…" : "Send code"}</button>
        <p className="center"><Link to="/login" className="link">Back to sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("employee");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const change = (e) => { setF({ ...f, [e.target.name]: e.target.value }); setErrors({ ...errors, [e.target.name]: "" }); setServerError(""); };
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.name.trim()) err.name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) err.email = "Enter a valid email, like name@company.com.";
    if (f.password.length < 8) err.password = "Use at least 8 characters.";
    if (f.confirm !== f.password) err.confirm = "Passwords do not match.";
    if (!agree) err.agree = "Please accept the privacy terms to continue.";
    if (Object.keys(err).length) return setErrors(err);
    try {
      setLoading(true);
      await register(f.name.trim(), f.email, f.password, role);
      navigate("/dashboard");
    } catch (ex) {
      setServerError(ex.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Create your account" subtitle="Join your team's wellness tracker in a minute.">
      <RoleSwitch role={role} setRole={setRole} />
      <form onSubmit={submit} noValidate>
        {serverError && <div className="alert" role="alert">{serverError}</div>}
        <div className="field">
          <label htmlFor="rname">Full name</label>
          <input id="rname" name="name" autoComplete="name" value={f.name} onChange={change} className={errors.name ? "invalid" : ""} />
          {errors.name && <span className="err">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="remail">Work email</label>
          <input id="remail" name="email" type="email" autoComplete="email" placeholder="name@company.com" value={f.email} onChange={change} className={errors.email ? "invalid" : ""} />
          {errors.email && <span className="err">{errors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="rpw">Password</label>
          <div className="pw">
            <input id="rpw" name="password" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={f.password} onChange={change} className={errors.password ? "invalid" : ""} />
            <button type="button" className="link-btn" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
          </div>
          <PasswordStrength value={f.password} />
          {errors.password && <span className="err">{errors.password}</span>}
        </div>
        <div className="field">
          <label htmlFor="rconf">Confirm password</label>
          <input id="rconf" name="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" value={f.confirm} onChange={change} className={errors.confirm ? "invalid" : ""} />
          {errors.confirm && <span className="err">{errors.confirm}</span>}
        </div>
        <label className="check" style={{ marginBottom: 6 }}>
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors({ ...errors, agree: "" }); }} /> I agree to the privacy terms
        </label>
        {errors.agree && <span className="err">{errors.agree}</span>}
        <button className="btn" type="submit" disabled={loading} style={{ marginTop: 14 }}>{loading ? "Creating account…" : "Create account"}</button>
        <p className="center">Already have an account? <Link to="/login" className="link">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

/* ---------- open on your phone (desktop only) ---------- */
function QRCodeSvg({ text, size = 184 }) {
  let n = 0;
  let d = "";
  try {
    const qr = new QRCode(-1, 0); // automatic size, error correction level M
    qr.addData(text);
    qr.make();
    n = qr.getModuleCount();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  } catch {
    return <p className="muted small">That link is too long for a QR code.</p>;
  }
  return (
    <svg className="qr" viewBox={`0 0 ${n + 8} ${n + 8}`} width={size} height={size} role="img" aria-label="QR code that opens this site on a phone" shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#ffffff" />
      <path d={d} fill="#10242f" />
    </svg>
  );
}

function PhoneLink() {
  const here = window.location.href.split("#")[0];
  const [url, setUrl] = useState(/^https?:\/\//.test(here) ? here : "");
  const [copied, setCopied] = useState(false);
  const clean = url.trim();
  const valid = /^https?:\/\/[^\s]+$/.test(clean);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      const el = document.getElementById("phone-url");
      if (el) { el.select(); try { document.execCommand("copy"); } catch {} }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section id="phone" className="lp-sec lp-desktop">
      <div className="lp-wrap phone-grid">
        <div>
          <h2>Open it on your phone</h2>
          <p className="lp-sub">Scan the code with your phone camera, or copy the link and send it to yourself. It works in any phone browser.</p>
          <label className="phone-label" htmlFor="phone-url">Site link</label>
          <div className="phone-row">
            <input id="phone-url" className="sel" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-name.github.io/your-repo/" spellCheck="false" />
            <button className="btn sm" disabled={!valid} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
          {!clean && <p className="muted small">Paste the address where you host this site, for example your GitHub Pages link.</p>}
        </div>
        <div className="phone-qr">
          {!valid ? <div className="qr-empty muted small">Enter a link to see the QR code</div>
            : clean.length > 120 ? <div className="qr-empty muted small">This link is too long for a QR code to scan reliably. Use a shorter link.</div>
            : <QRCodeSvg text={clean} />}
        </div>
      </div>
    </section>
  );
}

function Landing() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); };
  const demo = (role) => {
    store.set(KEY, JSON.stringify({ email: "demo@wellness.app", role, name: role === "employee" ? "Demo employee" : "Demo manager" }));
    navigate("/dashboard");
  };
  const features = [
    ["⏱️", "Real-time work tracking", "Start, pause and stop work sessions and see focus time against distractions."],
    ["🙂", "Mood check-ins and surveys", "A quick daily mood check and a weekly survey give you a wellness score."],
    ["🔥", "Burnout alerts", "Spot long hours and low mood early, before they turn into burnout."],
    ["🎯", "Focus mode", "A Pomodoro timer, distraction log and break reminders for deep work."],
    ["🧘", "Fitness and mind tips", "Breathing exercises, hydration and suggestions based on your work habits."],
    ["🔗", "Works with your tools", "Connect Google Calendar, Slack and Microsoft Teams for reminders and tracking."],
  ];
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <div className="brand dark"><span className="brand-mark" />Wellness Tracker</div>
          <nav className="lp-links" aria-label="Sections">
            {[["features", "Features"], ["teams", "For teams"], ["how", "How it works"], ["privacy", "Privacy"], ["phone", "On your phone"]].map(([id, l]) => (
              <button key={id} className="nav-link" onClick={() => scrollTo(id)}>{l}</button>
            ))}
          </nav>
          <div className="lp-cta">
            {loggedIn ? (
              <button className="btn sm" onClick={() => navigate("/dashboard")}>Open dashboard</button>
            ) : (
              <>
                <button className="btn sm ghost" onClick={() => navigate("/login")}>Sign in</button>
                <button className="btn sm lp-hide" onClick={() => navigate("/register")}>Get started</button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <h1>Healthier teams do better work.</h1>
            <p className="lp-lead">Track work hours and focus, check in on mood and catch burnout early. One calm dashboard for employees and managers.</p>
            <div className="btn-row">
              <button className="btn lg" onClick={() => navigate("/register")}>Get started</button>
              <button className="btn lg ghost" onClick={() => demo("employee")}>Try the demo</button>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>No credit card. The demo uses sample data.</p>
          </div>
          <div className="mock" aria-hidden="true">
            <div className="mock-top"><b>Your week</b><span className="role-badge">Employee</span></div>
            <div className="mock-stats">
              <div><b>38.5 h</b><span>Worked</span></div>
              <div><b>82%</b><span>Focus</span></div>
              <div><b>Low</b><span>Burnout risk</span></div>
            </div>
            <div className="mock-bars">{[60, 80, 55, 90, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            <div className="mock-mood"><span>🙂</span><span>😄</span><span>😐</span><span>🙂</span><span>😄</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="lp-sec">
        <div className="lp-wrap">
          <h2>Everything for wellbeing and focus</h2>
          <p className="lp-sub">Six tools that work together, from the first session of the day to the weekly review.</p>
          <div className="lp-grid">
            {features.map(([i, t, d]) => (
              <div className="lp-card" key={t}><span className="lp-ico" aria-hidden="true">{i}</span><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="teams" className="lp-sec lp-alt">
        <div className="lp-wrap lp-two">
          <div className="lp-card">
            <span className="role-badge">Employee</span>
            <h3>Know how your week is going</h3>
            <ul className="lp-list">
              <li>Work sessions, peak hours and weekly report</li>
              <li>Mood check-in, survey and wellness score</li>
              <li>Focus mode with distraction tracker</li>
              <li>Fitness, hydration and breathing exercises</li>
            </ul>
            <button className="btn sm ghost" onClick={() => demo("employee")}>See employee demo</button>
          </div>
          <div className="lp-card">
            <span className="role-badge mgmt">Management</span>
            <h3>See how your team is doing</h3>
            <ul className="lp-list">
              <li>Weekly team overview with live status</li>
              <li>Attendance, burnout risk and anonymous feedback</li>
              <li>HR wellness programs and analytics</li>
              <li>Reports, billing and integrations</li>
            </ul>
            <button className="btn sm ghost" onClick={() => demo("management")}>See management demo</button>
          </div>
        </div>
      </section>

      <section id="how" className="lp-sec">
        <div className="lp-wrap">
          <h2>How it works</h2>
          <div className="lp-grid lp-steps">
            {[["1", "Sign in", "Choose Employee or Management and sign in, or create an account."], ["2", "Track and check in", "Run work sessions, log your mood and take the weekly survey."], ["3", "Review the week", "Employees see their own trends. Managers see team trends and alerts."]].map(([n, t, d]) => (
              <div className="lp-card" key={n}><span className="lp-num">{n}</span><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="lp-sec lp-alt">
        <div className="lp-wrap">
          <h2>Built around privacy</h2>
          <p className="lp-sub">Feedback is anonymous. Individual wellness data is shared only with consent. Anyone can download or delete their data, and multi-factor sign-in is available.</p>
          <div className="btn-row"><button className="btn lg" onClick={() => navigate("/register")}>Create your account</button></div>
        </div>
      </section>

      <PhoneLink />

      <footer className="lp-foot">
        <div className="lp-wrap"><span>© 2026 Wellness Tracker</span><span className="muted">Demo project built with React. All numbers shown in the app are sample data.</span></div>
      </footer>
    </div>
  );
}



const week = [
  { day: "Mon", hours: 7.2, focus: 4.8 },
  { day: "Tue", hours: 8.1, focus: 5.4 },
  { day: "Wed", hours: 6.5, focus: 3.9 },
  { day: "Thu", hours: 8.6, focus: 5.1 },
  { day: "Fri", hours: 7.0, focus: 4.6 },
];

const moods = [
  { id: "great", label: "Great", icon: "😄" },
  { id: "good", label: "Good", icon: "🙂" },
  { id: "okay", label: "Okay", icon: "😐" },
  { id: "low", label: "Low", icon: "😕" },
  { id: "stressed", label: "Stressed", icon: "😣" },
];

const activity = [
  { time: "09:05", what: "Started work session", tag: "Work" },
  { time: "10:40", what: "Focus block: 50 min", tag: "Focus" },
  { time: "11:30", what: "Took a 10 min break", tag: "Break" },
  { time: "13:15", what: "Team standup (Google Calendar)", tag: "Meeting" },
  { time: "14:00", what: "Focus block: 25 min", tag: "Focus" },
];

const nav = ["Overview", "Work sessions", "Wellness", "Focus mode", "Fitness", "Survey", "Reports", "Integrations", "Privacy"];

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function EmployeeDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [mood, setMood] = useState(null);
  const path = React.useContext(PathContext);
  const active = tabFromPath(path, nav);
  const setActive = (n) => navigate(tabPath(n));

  // work session timer (start / pause)
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // pomodoro (25 min)
  const [pomo, setPomo] = useState(25 * 60);
  const [pomoOn, setPomoOn] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!pomoOn) return;
    const t = setInterval(
      () =>
        setPomo((p) => {
          if (p <= 1) {
            setPomoOn(false);
            return 25 * 60;
          }
          return p - 1;
        }),
      1000
    );
    return () => clearInterval(t);
  }, [pomoOn]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const maxHours = Math.max(...week.map((d) => d.hours));
  const burnout = 34; // 0-100, from your AI module later

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand dark">
          <span className="brand-mark" />
          Wellness Tracker
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n}
              className={`nav-item ${active === n ? "on" : ""}`}
              onClick={() => setActive(n)}
            >
              {n}
            </button>
          ))}
        </nav>
        <button className="nav-item logout" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      <section className="content">
        <PageNav />
        <header className="topbar">
          <div>
            <h1>
              {greeting}, {user?.name || "there"}
            </h1>
            <p className="muted">Here's how your week is going. <span className="role-badge">Employee</span></p>
          </div>
          <div className="top-right">
            <Bell items={empAlerts} />
            <div className="avatar" title={user?.email}>
              {(user?.name || "U").charAt(0)}
            </div>
          </div>
        </header>

        {active !== "Overview" && (
          <EmployeeSection name={active} ctx={{ seconds, running, setRunning, setSeconds, pomo, pomoOn, setPomoOn, setPomo, mood, setMood, burnout }} />
        )}
        {active === "Overview" && (<>
        {/* Stat row */}
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Hours worked this week</span>
            <strong>37.4 h</strong>
            <span className="delta up">+2.1 h vs last week</span>
          </div>
          <div className="stat">
            <span className="stat-label">Productivity score</span>
            <strong>82%</strong>
            <span className="delta up">+5% vs last week</span>
          </div>
          <div className="stat">
            <span className="stat-label">Focus time</span>
            <strong>23.8 h</strong>
            <span className="delta down">-1.2 h vs last week</span>
          </div>
          <div className="stat">
            <span className="stat-label">Wellness score</span>
            <strong>76</strong>
            <span className="delta up">Stable</span>
          </div>
        </div>

        <div className="grid">
          {/* Chart */}
          <div className="panel span2">
            <div className="panel-head">
              <h3>Work hours and focus time</h3>
              <div className="legend">
                <span><i className="dot hours" /> Total</span>
                <span><i className="dot focus" /> Focused</span>
              </div>
            </div>
            <div className="chart">
              {week.map((d) => (
                <div className="bar-col" key={d.day}>
                  <div className="bars">
                    <div className="bar hours" style={{ height: `${(d.hours / maxHours) * 100}%` }} title={`${d.hours} h`} />
                    <div className="bar focus" style={{ height: `${(d.focus / maxHours) * 100}%` }} title={`${d.focus} h`} />
                  </div>
                  <span className="bar-label">{d.day}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Your best focus window is 10:00 to 12:00. Plan deep work then.</p>
          </div>

          {/* Mood */}
          <div className="panel">
            <h3>How are you feeling?</h3>
            <div className="moods">
              {moods.map((m) => (
                <button
                  key={m.id}
                  className={`mood ${mood === m.id ? "on" : ""}`}
                  onClick={() => setMood(m.id)}
                  aria-pressed={mood === m.id}
                >
                  <span className="emoji">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="muted small">
              {mood ? "Check-in saved. Thanks for letting us know." : "Pick one to log today's check-in."}
            </p>
          </div>

          {/* Session timer */}
          <div className="panel">
            <h3>Work session</h3>
            <div className="timer">{fmt(seconds)}</div>
            <div className="btn-row">
              <button className="btn sm" onClick={() => setRunning(!running)}>
                {running ? "Pause" : seconds ? "Resume" : "Start"}
              </button>
              <button
                className="btn sm ghost"
                onClick={() => {
                  setRunning(false);
                  setSeconds(0);
                }}
              >
                Stop
              </button>
            </div>
          </div>

          {/* Pomodoro */}
          <div className="panel">
            <h3>Focus mode</h3>
            <div className="timer">{fmt(pomo)}</div>
            <div className="btn-row">
              <button className="btn sm" onClick={() => setPomoOn(!pomoOn)}>
                {pomoOn ? "Pause" : "Start 25 min focus"}
              </button>
              <button
                className="btn sm ghost"
                onClick={() => {
                  setPomoOn(false);
                  setPomo(25 * 60);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Burnout */}
          <div className="panel">
            <h3>Burnout risk</h3>
            <div className="meter">
              <div className="meter-fill" style={{ width: `${burnout}%` }} />
            </div>
            <div className="meter-scale">
              <span>Low</span><span>Moderate</span><span>High</span>
            </div>
            <p className="small">
              Your risk is <b>low to moderate</b>. Try a 10 minute walk after your next focus block.
            </p>
          </div>

          {/* Activity */}
          <div className="panel span2">
            <h3>Today's activity</h3>
            <ul className="activity">
              {activity.map((a) => (
                <li key={a.time}>
                  <span className="time">{a.time}</span>
                  <span className="what">{a.what}</span>
                  <span className={`tag ${a.tag.toLowerCase()}`}>{a.tag}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="panel">
            <h3>Suggestions for you</h3>
            <ul className="tips">
              <li>Drink a glass of water.</li>
              <li>Stretch your neck and shoulders for 2 minutes.</li>
              <li>Step away from the screen at 3:30 PM.</li>
            </ul>
          </div>
        </div>
        </>)}
      </section>
    </div>
  );
}

/* ---------- management dashboard (weekly) ---------- */
const mgmtNav = ["Overview", "Team", "Attendance", "Wellness", "Analytics", "Feedback", "Programs", "Reports", "Integrations", "Billing", "Privacy"];
const teamWeek = [
  { day: "Mon", hours: 8.1, focus: 5.2 },
  { day: "Tue", hours: 8.4, focus: 5.6 },
  { day: "Wed", hours: 7.9, focus: 4.9 },
  { day: "Thu", hours: 8.8, focus: 5.4 },
  { day: "Fri", hours: 7.2, focus: 4.4 },
];
const team = [
  { name: "Aarav Kumar", role: "Frontend", hours: 39.5, prod: 88, mood: "😄", risk: "Low" },
  { name: "Divya Nair", role: "Backend", hours: 41.2, prod: 84, mood: "🙂", risk: "Low" },
  { name: "Karthik S", role: "QA", hours: 44.8, prod: 71, mood: "😣", risk: "High" },
  { name: "Meena R", role: "Design", hours: 36.0, prod: 79, mood: "😐", risk: "Moderate" },
  { name: "Rahul P", role: "DevOps", hours: 43.1, prod: 76, mood: "😕", risk: "Moderate" },
];
const attendance = [
  { label: "Present", n: 18, cls: "ok" },
  { label: "Late", n: 3, cls: "warn" },
  { label: "On leave", n: 2, cls: "info" },
  { label: "Absent", n: 1, cls: "bad" },
];
const teamMoods = [
  { icon: "😄", label: "Great", n: 6 },
  { icon: "🙂", label: "Good", n: 9 },
  { icon: "😐", label: "Okay", n: 5 },
  { icon: "😕", label: "Low", n: 3 },
  { icon: "😣", label: "Stressed", n: 2 },
];
const alerts = [
  "Karthik S logged 44.8 h this week and reported stress 3 days in a row.",
  "Rahul P worked past 8 PM on 3 days.",
  "Meena R has taken no breaks on 2 days. Suggest a check-in.",
];

function ManagementDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const path = React.useContext(PathContext);
  const active = tabFromPath(path, mgmtNav);
  const setActive = (n) => navigate(tabPath(n));
  const [week, setWeek] = useState("This week");
  const handleLogout = () => { logout(); navigate("/login"); };
  const maxH = Math.max(...teamWeek.map((d) => d.hours));
  const maxMood = Math.max(...teamMoods.map((m) => m.n));
  const atRisk = team.filter((t) => t.risk !== "Low").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand dark"><span className="brand-mark" />Wellness Tracker</div>
        <nav>
          {mgmtNav.map((n) => (
            <button key={n} className={`nav-item ${active === n ? "on" : ""}`} onClick={() => setActive(n)}>{n}</button>
          ))}
        </nav>
        <button className="nav-item logout" onClick={handleLogout}>Sign out</button>
      </aside>

      <section className="content">
        <PageNav />
        <header className="topbar">
          <div>
            <h1>Team overview, {user?.name || "Manager"}</h1>
            <p className="muted">Weekly view of productivity and wellbeing. <span className="role-badge mgmt">Management</span></p>
          </div>
          <div className="top-right">
            <Bell items={mgmtAlerts} />
          <div className="week-pick" role="tablist" aria-label="Week">
            {["This week", "Last week"].map((w) => (
              <button key={w} role="tab" aria-selected={week === w} className={week === w ? "on" : ""} onClick={() => setWeek(w)}>{w}</button>
            ))}
          </div>
          </div>
        </header>

        {active !== "Overview" && <ManagementSection name={active} />}
        {active === "Overview" && (<>
        <div className="stats">
          <div className="stat"><span className="stat-label">Team hours</span><strong>{week === "This week" ? "204.6 h" : "198.2 h"}</strong><span className="delta up">+3.2% vs prior week</span></div>
          <div className="stat"><span className="stat-label">Avg productivity</span><strong>{week === "This week" ? "80%" : "77%"}</strong><span className="delta up">+3%</span></div>
          <div className="stat"><span className="stat-label">Avg wellness score</span><strong>{week === "This week" ? "72" : "75"}</strong><span className="delta down">-3 points</span></div>
          <div className="stat"><span className="stat-label">At burnout risk</span><strong>{atRisk} of {team.length}</strong><span className="delta down">1 high</span></div>
        </div>

        <div className="grid">
          <div className="panel span2">
            <div className="panel-head">
              <h3>Team hours and focus by day</h3>
              <div className="legend"><span><i className="dot hours" /> Avg hours</span><span><i className="dot focus" /> Avg focus</span></div>
            </div>
            <div className="chart">
              {teamWeek.map((d) => (
                <div className="bar-col" key={d.day}>
                  <div className="bars">
                    <div className="bar hours" style={{ height: `${(d.hours / maxH) * 100}%` }} title={`${d.hours} h`} />
                    <div className="bar focus" style={{ height: `${(d.focus / maxH) * 100}%` }} title={`${d.focus} h`} />
                  </div>
                  <span className="bar-label">{d.day}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Friday focus time drops by about 20%. Consider fewer meetings late in the week.</p>
          </div>

          <div className="panel">
            <h3>Attendance this week</h3>
            <ul className="att">
              {attendance.map((a) => (
                <li key={a.label}><span className={`pill ${a.cls}`} />{a.label}<b>{a.n}</b></li>
              ))}
            </ul>
          </div>

          <div className="panel span2">
            <h3>Team members</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Employee</th><th>Hours</th><th>Productivity</th><th>Mood</th><th>Burnout risk</th></tr></thead>
                <tbody>
                  {team.map((t) => (
                    <tr key={t.name}>
                      <td><b>{t.name}</b><span className="muted small"> {t.role}</span></td>
                      <td>{t.hours} h</td>
                      <td><div className="mini"><i style={{ width: `${t.prod}%` }} /></div> {t.prod}%</td>
                      <td>{t.mood}</td>
                      <td><span className={`risk ${t.risk.toLowerCase()}`}>{t.risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Mood check-ins</h3>
            <ul className="att">
              {teamMoods.map((m) => (
                <li key={m.label}>
                  <span>{m.icon}</span>{m.label}
                  <div className="mini grow"><i style={{ width: `${(m.n / maxMood) * 100}%` }} /></div>
                  <b>{m.n}</b>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel span3">
            <h3>Needs attention</h3>
            <ul className="tips">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        </div>
        </>)}
      </section>
    </div>
  );
}

/* ---------- shared helpers ---------- */
const downloadCSV = (name, rows) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------- employee: other sidebar pages ---------- */
const sessions = [
  { day: "Mon", start: "09:05", end: "17:40", hours: 7.9, focus: 5.1 },
  { day: "Tue", start: "09:15", end: "18:05", hours: 8.2, focus: 5.4 },
  { day: "Wed", start: "09:00", end: "17:10", hours: 7.5, focus: 4.6 },
  { day: "Thu", start: "09:20", end: "18:30", hours: 8.6, focus: 5.0 },
  { day: "Fri", start: "09:10", end: "16:20", hours: 6.4, focus: 3.7 },
];
const moodWeek = [["Mon", "🙂"], ["Tue", "😄"], ["Wed", "😐"], ["Thu", "😕"], ["Fri", "🙂"]];

function EmployeeSection({ name, ctx }) {
  const [reminders, setReminders] = useState({ water: true, stretch: true, eyes: false });
  const [dist, setDist] = useState({ Phone: 2, "Social media": 1, Chat: 4, Noise: 1 });
  const [block, setBlock] = useState(false);
  const [every, setEvery] = useState("50");
  const total = sessions.reduce((a, d) => a + d.hours, 0).toFixed(1);
  const totalFocus = sessions.reduce((a, d) => a + d.focus, 0).toFixed(1);

  if (name === "Work sessions")
    return (
      <div className="grid">
        <div className="panel">
          <h3>Current session</h3>
          <div className="timer">{fmt(ctx.seconds)}</div>
          <div className="btn-row">
            <button className="btn sm" onClick={() => ctx.setRunning(!ctx.running)}>{ctx.running ? "Pause" : ctx.seconds ? "Resume" : "Start"}</button>
            <button className="btn sm ghost" onClick={() => { ctx.setRunning(false); ctx.setSeconds(0); }}>Stop</button>
          </div>
        </div>
        <div className="panel span2">
          <h3>This week's sessions</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Total</th><th>Focused</th></tr></thead>
              <tbody>
                {sessions.map((d) => (
                  <tr key={d.day}><td><b>{d.day}</b></td><td>{d.start}</td><td>{d.end}</td><td>{d.hours} h</td><td>{d.focus} h</td></tr>
                ))}
                <tr><td><b>Total</b></td><td /><td /><td><b>{total} h</b></td><td><b>{totalFocus} h</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel span3">
          <h3>Peak productivity hours</h3>
          <div className="hours-row">
            {peak.map(([h, v]) => (
              <div key={h}><div className="hbar"><i style={{ height: `${v}%` }} title={`${v}%`} /></div><span className="small muted">{h}</span></div>
            ))}
          </div>
          <p className="muted small">Your best focus window is 10:00 to 12:00. Break suggestion: a 5 minute pause every 50 minutes.</p>
        </div>
      </div>
    );

  if (name === "Wellness")
    return (
      <div className="grid">
        <div className="panel">
          <h3>Today's check-in</h3>
          <div className="moods">
            {moods.map((m) => (
              <button key={m.id} className={`mood ${ctx.mood === m.id ? "on" : ""}`} onClick={() => ctx.setMood(m.id)} aria-pressed={ctx.mood === m.id}>
                <span className="emoji">{m.icon}</span>{m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Mood this week</h3>
          <div className="mood-week">
            {moodWeek.map(([d, e]) => (<div key={d}><span className="emoji">{e}</span><span className="small muted">{d}</span></div>))}
          </div>
        </div>
        <div className="panel">
          <h3>Burnout risk</h3>
          <div className="meter"><div className="meter-fill" style={{ width: `${ctx.burnout}%` }} /></div>
          <div className="meter-scale"><span>Low</span><span>Moderate</span><span>High</span></div>
        </div>
        <div className="panel span3">
          <h3>AI insights (sample)</h3>
          <ul className="tips">
            <li>Your mood dips on Thursdays, after your longest work day.</li>
            <li>Check-in notes show more stress words this week. Burnout risk is rising slowly.</li>
            <li>Shorter meetings on Wednesday and Thursday afternoons could help.</li>
          </ul>
        </div>
        <div className="panel span3">
          <h3>Wellness reminders</h3>
          <ul className="att">
            {[["water", "Drink water every hour"], ["stretch", "Stretch break every 90 minutes"], ["eyes", "20-20-20 eye rest"]].map(([k, label]) => (
              <li key={k}>
                <label className="check"><input type="checkbox" checked={reminders[k]} onChange={() => setReminders({ ...reminders, [k]: !reminders[k] })} /> {label}</label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

  if (name === "Focus mode")
    return (
      <div className="grid">
        <div className="panel">
          <h3>Pomodoro</h3>
          <div className="timer">{fmt(ctx.pomo)}</div>
          <div className="btn-row">
            <button className="btn sm" onClick={() => ctx.setPomoOn(!ctx.pomoOn)}>{ctx.pomoOn ? "Pause" : "Start 25 min focus"}</button>
            <button className="btn sm ghost" onClick={() => { ctx.setPomoOn(false); ctx.setPomo(25 * 60); }}>Reset</button>
          </div>
        </div>
        <div className="panel span2">
          <h3>Today's focus blocks</h3>
          <ul className="activity">
            {activity.filter((a) => a.tag === "Focus").map((a) => (
              <li key={a.time}><span className="time">{a.time}</span><span className="what">{a.what}</span><span className="tag focus">Focus</span></li>
            ))}
          </ul>
          <p className="muted small">Work in 25 minute blocks, then take a 5 minute break. After four blocks, rest for 15 to 30 minutes.</p>
        </div>
        <div className="panel span2">
          <h3>Distraction tracker</h3>
          <div className="btn-row">
            {Object.keys(dist).map((k) => (
              <button key={k} className="btn sm ghost" onClick={() => setDist({ ...dist, [k]: dist[k] + 1 })}>+ {k} ({dist[k]})</button>
            ))}
          </div>
          {(() => {
            const n = Object.values(dist).reduce((a, b) => a + b, 0);
            const lost = n * 4;
            const pct = Math.round((150 / (150 + lost)) * 100);
            return (
              <>
                <div className="split"><i style={{ width: `${pct}%` }} /></div>
                <p className="small"><b>{pct}% focused</b>: 150 min focus, about {lost} min lost to {n} distractions today.</p>
              </>
            );
          })()}
        </div>
        <div className="panel">
          <h3>Alerts</h3>
          <Switch label="Focus mode: pause chat and email alerts" on={block} onChange={setBlock} />
          {block && <p className="small" role="status">Focus mode is on. Alerts are paused until you turn it off.</p>}
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label htmlFor="every">Break reminder</label>
            <select id="every" className="sel" value={every} onChange={(e) => setEvery(e.target.value)}>
              <option value="25">Every 25 minutes</option><option value="50">Every 50 minutes</option><option value="90">Every 90 minutes</option>
            </select>
          </div>
        </div>
      </div>
    );

  if (name === "Fitness") return <FitnessPage />;
  if (name === "Survey") return <SurveyPage />;
  if (name === "Integrations") return <IntegrationsPage list={empApps} />;
  if (name === "Privacy") return <PrivacyPage role="employee" />;

  // Reports
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Weekly report</h3>
        <button className="btn sm" onClick={() => downloadCSV("my-weekly-report.csv", [["Day", "Hours", "Focus hours"], ...sessions.map((d) => [d.day, d.hours, d.focus]), ["Total", total, totalFocus]])}>Download CSV</button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Day</th><th>Hours</th><th>Focus</th><th>Focus share</th></tr></thead>
          <tbody>
            {sessions.map((d) => (
              <tr key={d.day}><td><b>{d.day}</b></td><td>{d.hours} h</td><td>{d.focus} h</td><td><div className="mini"><i style={{ width: `${(d.focus / d.hours) * 100}%` }} /></div> {Math.round((d.focus / d.hours) * 100)}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Total {total} h worked, {totalFocus} h focused ({Math.round((totalFocus / total) * 100)}%).</p>
    </div>
  );
}

/* ---------- management: other sidebar pages ---------- */
const attWeek = [
  { name: "Aarav Kumar", d: ["P", "P", "P", "P", "P"] },
  { name: "Divya Nair", d: ["P", "P", "L", "P", "P"] },
  { name: "Karthik S", d: ["P", "P", "P", "P", "A"] },
  { name: "Meena R", d: ["P", "V", "V", "P", "P"] },
  { name: "Rahul P", d: ["L", "P", "P", "L", "P"] },
];
const attLabel = { P: "Present", L: "Late", A: "Absent", V: "Leave" };

function ManagementSection({ name }) {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("All");
  const order = { High: 0, Moderate: 1, Low: 2 };

  if (name === "Team") {
    const rows = team.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) && (risk === "All" || t.risk === risk));
    return (
      <>
      <LiveStatus />
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <input placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employee" />
          <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filter by burnout risk">
            {["All", "Low", "Moderate", "High"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Employee</th><th>Hours</th><th>Productivity</th><th>Mood</th><th>Burnout risk</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.name}>
                  <td><b>{t.name}</b><span className="muted small"> {t.role}</span></td><td>{t.hours} h</td>
                  <td><div className="mini"><i style={{ width: `${t.prod}%` }} /></div> {t.prod}%</td>
                  <td>{t.mood}</td><td><span className={`risk ${t.risk.toLowerCase()}`}>{t.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="muted small">No employees match.</p>}
      </div>
      </>
    );
  }

  if (name === "Attendance")
    return (
      <div className="panel">
        <h3>Attendance, this week</h3>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Employee</th>{["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {attWeek.map((r) => (
                <tr key={r.name}><td><b>{r.name}</b></td>{r.d.map((c, i) => <td key={i}><span className={`code ${c}`} title={attLabel[c]}>{c}</span></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">P present, L late, A absent, V on leave.</p>
      </div>
    );

  if (name === "Wellness") {
    const sorted = [...team].sort((a, b) => order[a.risk] - order[b.risk]);
    return (
      <div className="grid">
        <div className="panel span2">
          <h3>Burnout risk, highest first</h3>
          <ul className="att">
            {sorted.map((t) => (
              <li key={t.name}><span>{t.mood}</span>{t.name}<span className={`risk ${t.risk.toLowerCase()}`} style={{ marginLeft: "auto" }}>{t.risk}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h3>Suggested actions</h3>
          <ul className="tips">
            <li>Check in 1:1 with high-risk employees.</li>
            <li>Move late-day meetings earlier.</li>
            <li>Encourage use of focus mode and breaks.</li>
          </ul>
        </div>
        <div className="panel span3">
          <h3>Needs attention</h3>
          <ul className="tips">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
    );
  }

  if (name === "Analytics") return <AnalyticsPage />;
  if (name === "Feedback") return <FeedbackPage />;
  if (name === "Programs") return <ProgramsPage />;
  if (name === "Integrations") return <IntegrationsPage list={mgmtApps} />;
  if (name === "Billing") return <BillingPage />;
  if (name === "Privacy") return <PrivacyPage role="management" />;

  // Reports
  const rows = [["Employee", "Role", "Hours", "Productivity %", "Burnout risk"], ...team.map((t) => [t.name, t.role, t.hours, t.prod, t.risk])];
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Weekly team report</h3>
        <button className="btn sm" onClick={() => downloadCSV("team-weekly-report.csv", rows)}>Download CSV</button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr>{rows[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- extra pages from the project spec ---------- */
const peak = [["9", 55], ["10", 92], ["11", 95], ["12", 60], ["1", 40], ["2", 70], ["3", 78], ["4", 58], ["5", 35]];
const empAlerts = [
  { type: "break", label: "Break", text: "You have worked 90 minutes without a break. Take 5 minutes." },
  { type: "alert", label: "Stress", text: "Your mood was low two days in a row. Try the breathing exercise in Fitness." },
  { type: "meeting", label: "Calendar", text: "Team standup at 1:15 PM (Google Calendar)." },
];
const mgmtAlerts = [
  { type: "alert", label: "Burnout", text: "Karthik S moved to high burnout risk." },
  { type: "break", label: "Feedback", text: "3 new anonymous feedback items." },
  { type: "meeting", label: "Billing", text: "Business plan renews in 12 days." },
];
const empApps = [
  { name: "Google Calendar", icon: "📅", desc: "Meetings are counted as meeting time.", on: true },
  { name: "Slack", icon: "💬", desc: "Get break reminders in Slack.", on: false },
  { name: "Microsoft Teams", icon: "👥", desc: "Sync status and reminders.", on: false },
  { name: "Google Fit", icon: "🏃", desc: "Steps and activity minutes.", on: true },
  { name: "Wearable (Fitbit, Apple Watch)", icon: "⌚", desc: "Heart rate and sleep.", on: false },
];
const mgmtApps = [
  { name: "Google Calendar", icon: "📅", desc: "Team meeting load and focus time.", on: true },
  { name: "Slack", icon: "💬", desc: "Send wellness reminders to channels.", on: true },
  { name: "Microsoft Teams", icon: "👥", desc: "Send wellness reminders in Teams.", on: false },
  { name: "HR platform", icon: "🏢", desc: "Sync employees and wellness programs.", on: false },
];

function Bell({ items }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(items.length);
  return (
    <div className="bell-wrap">
      <button className="bell" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => { setOpen(!open); setUnread(0); }}>
        🔔{unread > 0 && <span className="bell-n">{unread}</span>}
      </button>
      {open && (
        <div className="bell-pop">
          <b>Alerts</b>
          <ul>{items.map((t) => <li key={t.text}><span className={`tag ${t.type}`}>{t.label}</span> {t.text}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Switch({ on, onChange, label }) {
  return (
    <label className="sw-row">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} className={`sw ${on ? "on" : ""}`} onClick={() => onChange(!on)}><i /></button>
    </label>
  );
}

function IntegrationsPage({ list }) {
  const [on, setOn] = useState(() => Object.fromEntries(list.map((i) => [i.name, i.on])));
  return (
    <div className="panel">
      <h3>Connected apps</h3>
      <ul className="int">
        {list.map((i) => (
          <li key={i.name}>
            <span className="int-ico">{i.icon}</span>
            <div><b>{i.name}</b><div className="muted small">{i.desc}</div></div>
            <button className={`btn sm ${on[i.name] ? "ghost" : ""}`} onClick={() => setOn({ ...on, [i.name]: !on[i.name] })}>{on[i.name] ? "Disconnect" : "Connect"}</button>
          </li>
        ))}
      </ul>
      <p className="muted small">Demo only. Real connections will use OAuth2 once the backend is ready.</p>
    </div>
  );
}

function PrivacyPage({ role }) {
  const [s, setS] = useState({ mfa: false, email: true, share: true, hours: true });
  const [msg, setMsg] = useState("");
  const set = (k) => (v) => setS({ ...s, [k]: v });
  return (
    <div className="grid">
      <div className="panel span2">
        <h3>Security</h3>
        <Switch label="Multi-factor authentication (code from an authenticator app)" on={s.mfa} onChange={set("mfa")} />
        <Switch label="Email me about new sign-ins" on={s.email} onChange={set("email")} />
      </div>
      <div className="panel">
        <h3>Your data</h3>
        <div className="btn-row">
          <button className="btn sm ghost" onClick={() => { downloadCSV("my-data.csv", [["Setting", "Value"], ["Role", role], ["Multi-factor", s.mfa], ["Share wellness data", s.share], ["Track work hours only", s.hours]]); setMsg("Your data export was created."); }}>Download my data</button>
          <button className="btn sm ghost" onClick={() => setMsg("Deletion request noted. HR will confirm it.")}>Request deletion</button>
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
      </div>
      <div className="panel span3">
        <h3>Privacy controls</h3>
        <Switch label={role === "employee" ? "Let my manager see my mood and burnout risk" : "Show individual wellness data only for employees who agreed"} on={s.share} onChange={set("share")} />
        <Switch label="Track activity only during work sessions" on={s.hours} onChange={set("hours")} />
        <p className="muted small">Feedback is always anonymous. You can download or delete your data at any time. These switches are a demo until the backend stores them.</p>
      </div>
    </div>
  );
}

function FitnessPage() {
  const [water, setWater] = useState(3);
  const [breathing, setBreathing] = useState(false);
  const [phase, setPhase] = useState(0);
  const phases = ["Inhale", "Hold", "Exhale", "Hold"];
  useEffect(() => {
    if (!breathing) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 4), 4000);
    return () => clearInterval(t);
  }, [breathing]);
  const stats = [["Steps", "6,420", "goal 8,000"], ["Sleep", "6.8 h", "goal 7.5 h"], ["Heart rate", "72 bpm", "resting 64"], ["Active time", "34 min", "goal 45 min"]];
  return (
    <>
      <div className="stats">
        {stats.map(([l, v, d]) => (
          <div className="stat" key={l}><span className="stat-label">{l}</span><strong>{v}</strong><span className="muted small">{d} (sample wearable data)</span></div>
        ))}
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Breathing exercise</h3>
          <div className="breath-ex-wrap">
            <div className="breath-ex" style={{ transform: breathing ? (phase < 2 ? "scale(1.25)" : "scale(0.85)") : "scale(1)" }}>
              {breathing ? phases[phase] : "Ready"}
            </div>
          </div>
          <button className="btn sm" onClick={() => { setBreathing(!breathing); setPhase(0); }}>{breathing ? "Stop" : "Start 4-4-4-4"}</button>
        </div>
        <div className="panel">
          <h3>Hydration</h3>
          <div className="timer">{water} / 8</div>
          <div className="split"><i style={{ width: `${(water / 8) * 100}%` }} /></div>
          <div className="btn-row">
            <button className="btn sm" onClick={() => setWater(Math.min(8, water + 1))}>+ Glass</button>
            <button className="btn sm ghost" onClick={() => setWater(Math.max(0, water - 1))}>Undo</button>
          </div>
        </div>
        <div className="panel">
          <h3>Suggestions for you</h3>
          <ul className="tips">
            <li>You have been sitting for about 2 hours. Stand and stretch for 2 minutes.</li>
            <li>Sleep was under 7 h. Avoid late meetings and take a lunch walk.</li>
            <li>Try 5 minutes of meditation before your next focus block.</li>
            <li>Switch off work notifications after 7 PM.</li>
          </ul>
          <p className="muted small">Based on your work habits (sample).</p>
        </div>
      </div>
    </>
  );
}

const surveyQs = [
  ["workload", "How manageable was your workload this week?"],
  ["calm", "How calm did you feel at work?"],
  ["sleep", "How well did you sleep?"],
  ["energy", "How was your energy during the day?"],
  ["support", "How supported did you feel by your team?"],
];
function SurveyPage() {
  const [ans, setAns] = useState({});
  const [score, setScore] = useState(null);
  const [fb, setFb] = useState("");
  const [sent, setSent] = useState(false);
  const done = surveyQs.every(([k]) => ans[k]);
  return (
    <div className="grid">
      <div className="panel span2">
        <h3>Weekly wellness survey</h3>
        <p className="muted small">1 is poor, 5 is great. It takes about a minute.</p>
        {surveyQs.map(([k, q]) => (
          <fieldset className="q" key={k}>
            <legend>{q}</legend>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={ans[k] === n ? "on" : ""}>
                  <input type="radio" name={k} checked={ans[k] === n} onChange={() => setAns({ ...ans, [k]: n })} />{n}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="btn sm" disabled={!done} onClick={() => setScore(Math.round((Object.values(ans).reduce((a, b) => a + b, 0) / 25) * 100))}>Submit survey</button>
        {score !== null && (
          <p className="small" role="status">Thanks. Your wellness score is <b>{score}</b>. {score < 60 ? "That looks low. Consider talking to your manager or HR." : "Keep it up."}</p>
        )}
      </div>
      <div className="panel">
        <h3>Anonymous feedback</h3>
        <p className="muted small">Goes to HR without your name.</p>
        <textarea className="ta" rows="5" value={fb} onChange={(e) => { setFb(e.target.value); setSent(false); }} placeholder="Share what would help you work better" aria-label="Anonymous feedback" />
        <button className="btn sm" disabled={!fb.trim()} onClick={() => { setSent(true); setFb(""); }}>Send anonymously</button>
        {sent && <p className="small" role="status">Sent. Thank you.</p>}
      </div>
    </div>
  );
}

const liveStates = ["Working", "Focus", "On break", "Meeting", "Idle"];
function LiveStatus() {
  const [rows, setRows] = useState(team.map((t, i) => ({ name: t.name, s: liveStates[i % 4] })));
  useEffect(() => {
    const t = setInterval(() => {
      setRows((r) => r.map((x) => (Math.random() < 0.3 ? { ...x, s: liveStates[Math.floor(Math.random() * liveStates.length)] } : x)));
    }, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="panel">
      <div className="panel-head"><h3>Live status</h3><span className="live"><i />Live (demo)</span></div>
      <ul className="att">
        {rows.map((r) => (
          <li key={r.name}>{r.name}<span className={`status ${r.s.replace(" ", "-").toLowerCase()}`} style={{ marginLeft: "auto" }}>{r.s}</span></li>
        ))}
      </ul>
    </div>
  );
}

const trend = [["W1", 64], ["W2", 66], ["W3", 65], ["W4", 69], ["W5", 71], ["W6", 74], ["W7", 75], ["W8", 72]];
function AnalyticsPage() {
  const cards = [["User adoption", "86%", "18 of 21 employees active"], ["Engagement", "4.2", "check-ins per employee a week"], ["Privacy compliance", "96%", "checks passed"], ["Company impact", "+8", "wellness points in 8 weeks"]];
  return (
    <>
      <div className="stats">
        {cards.map(([l, v, d]) => (
          <div className="stat" key={l}><span className="stat-label">{l}</span><strong>{v}</strong><span className="muted small">{d}</span></div>
        ))}
      </div>
      <div className="grid">
        <div className="panel span2">
          <h3>Wellness score, last 8 weeks</h3>
          <div className="chart">
            {trend.map(([w, v]) => (
              <div className="bar-col" key={w}>
                <div className="bars"><div className="bar focus" style={{ height: `${v}%` }} title={`${v}`} /></div>
                <span className="bar-label">{w}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Productivity with focus mode</h3>
          <div className="chart">
            {[["Before", 68], ["After", 82]].map(([w, v]) => (
              <div className="bar-col" key={w}>
                <div className="bars"><div className="bar hours" style={{ height: `${v}%` }} title={`${v}%`} /></div>
                <span className="bar-label">{w} {v}%</span>
              </div>
            ))}
          </div>
          <p className="muted small">Sample numbers: a 14 point rise after teams began using focus mode.</p>
        </div>
      </div>
    </>
  );
}

const themes = [["Workload", 12, "Negative"], ["Meetings", 9, "Negative"], ["Team support", 8, "Positive"], ["Flexible hours", 7, "Positive"], ["Tools", 4, "Neutral"]];
const sentRisk = { Negative: "high", Neutral: "moderate", Positive: "low" };
function FeedbackPage() {
  return (
    <div className="grid">
      <div className="panel span2">
        <h3>Anonymous feedback themes</h3>
        <ul className="att">
          {themes.map(([t, n, sent]) => (
            <li key={t}>{t}<div className="mini grow"><i style={{ width: `${(n / 12) * 100}%` }} /></div><b>{n}</b><span className={`risk ${sentRisk[sent]}`}>{sent}</span></li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h3>Recent comments</h3>
        <ul className="tips">
          <li>Too many late meetings on Thursdays.</li>
          <li>Remote Fridays help me recover.</li>
          <li>I would like quiet focus hours without chat.</li>
        </ul>
        <p className="muted small">Comments carry no names. Groups under 5 people are hidden.</p>
      </div>
    </div>
  );
}

const programs = [
  ["Mindfulness week", "Daily 10 minute guided sessions", 14],
  ["Step challenge", "Team goal of 8,000 steps a day", 17],
  ["Counselling support", "Confidential sessions with an HR partner", 5],
  ["Ergonomics workshop", "Desk setup and posture", 9],
];
function ProgramsPage() {
  const [on, setOn] = useState({ "Mindfulness week": true, "Step challenge": true });
  return (
    <div className="panel">
      <h3>HR wellness programs</h3>
      <ul className="int">
        {programs.map(([n, d, enrolled]) => (
          <li key={n}>
            <div style={{ flex: 1 }}>
              <b>{n}</b> <span className={`tag ${on[n] ? "focus" : ""}`}>{on[n] ? "Running" : "Paused"}</span>
              <div className="muted small">{d}</div>
              <div className="mini wide"><i style={{ width: `${(enrolled / 21) * 100}%` }} /></div> <span className="small">{enrolled} of 21 enrolled</span>
            </div>
            <button className={`btn sm ${on[n] ? "ghost" : ""}`} onClick={() => setOn({ ...on, [n]: !on[n] })}>{on[n] ? "Pause" : "Launch"}</button>
          </li>
        ))}
      </ul>
      <p className="muted small">Connect your HR platform in Integrations to sync enrolment automatically.</p>
    </div>
  );
}

const plans = [
  ["Starter", "₹0", "Up to 10 users. Basic tracking and reminders."],
  ["Business", "₹299", "per user a month. Analytics, burnout alerts and integrations."],
  ["Enterprise", "Custom", "SSO, HR integration, audit reports and priority support."],
];
const invoices = [["01 Oct 2026", "Business", "₹6,279", "Paid"], ["01 Sep 2026", "Business", "₹6,279", "Paid"], ["01 Aug 2026", "Starter", "₹0", "Paid"]];
function BillingPage() {
  const [plan, setPlan] = useState("Business");
  const [msg, setMsg] = useState("");
  return (
    <div className="grid">
      {plans.map(([n, price, d]) => (
        <div className={`panel plan ${plan === n ? "cur" : ""}`} key={n}>
          <h3>{n}</h3>
          <div className="price">{price}</div>
          <p className="muted small">{d}</p>
          <button className={`btn sm ${plan === n ? "" : "ghost"}`} disabled={plan === n} onClick={() => { setPlan(n); setMsg(`Plan changed to ${n} (demo).`); }}>{plan === n ? "Current plan" : "Select"}</button>
        </div>
      ))}
      <div className="panel span3">
        <div className="panel-head">
          <h3>Invoices</h3>
          <button className="btn sm ghost" onClick={() => setMsg("Razorpay or Stripe checkout will open here once payments are connected.")}>Add payment method</button>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{invoices.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 3 ? <span className="risk low">{c}</span> : c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
      </div>
    </div>
  );
}

function Dashboard() {
  return getUser()?.role === "management" ? <ManagementDashboard /> : <EmployeeDashboard />;
}

/* ---------- app ---------- */
const routes = ["/", "/login", "/register", "/forgot-password", "/dashboard"];
const fromHash = () => {
  const h = window.location.hash.slice(1);
  if (h.startsWith("/dashboard")) return isLoggedIn() ? h : "/login";
  if (!routes.includes(h)) return isLoggedIn() ? "/dashboard" : "/";
  return h;
};
function App() {
  const [path, setPath] = useState(fromHash);
  const pathRef = useRef(path);
  const show = (p) => { pathRef.current = p; setPath(p); window.scrollTo(0, 0); };
  useEffect(() => {
    try { window.history.replaceState({ i: 0 }, "", window.location.href); } catch {}
    const onPop = () => {
      const p = fromHash();
      try { if (window.location.hash && window.location.hash.slice(1) !== p) window.history.replaceState(window.history.state, "", "#" + p); } catch {}
      show(p);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (to) => {
    const from = pathRef.current;
    if (to === from) return;
    // after signing in or out, replace the page so Back never returns to a stale form
    const replace = (!from.startsWith("/dashboard") && to.startsWith("/dashboard")) || (from.startsWith("/dashboard") && to === "/login");
    try {
      const i = (window.history.state && window.history.state.i) || 0;
      if (replace) window.history.replaceState({ i }, "", "#" + to);
      else window.history.pushState({ i: i + 1 }, "", "#" + to);
    } catch {}
    show(to);
  };
  const back = () => {
    const i = window.history.state && window.history.state.i;
    if (i > 0) window.history.back();
    else go("/");
  };
  let page;
  if (path === "/") page = <Landing />;
  else if (path === "/register") page = <Register />;
  else if (path === "/forgot-password") page = <ForgotPassword />;
  else if (path.startsWith("/dashboard") && isLoggedIn()) page = <Dashboard />;
  else page = <Login />;
  return (
    <NavContext.Provider value={go}>
      <BackContext.Provider value={back}>
        <PathContext.Provider value={path}>{page}</PathContext.Provider>
      </BackContext.Provider>
    </NavContext.Provider>
  );
}

export default App;
