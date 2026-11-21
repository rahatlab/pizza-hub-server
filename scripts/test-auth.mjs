const BASE = "http://localhost:5000";
const ORIGIN = "http://localhost:3000";

let cookies = new Map();

function jar() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  const list = res.headers.getSetCookie?.() ?? [];
  for (const raw of list) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === "" || /expires=Thu, 01 Jan 1970/i.test(raw)) cookies.delete(name);
    else cookies.set(name, value);
  }
}

async function call(path, { method = "GET", body, auth, cookie = true } = {}) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (cookie && cookies.size) headers.cookie = jar();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  storeCookies(res);

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `  → ${JSON.stringify(detail)}`}`);
}

// wait for the dev server
let healthy = false;
for (let i = 0; i < 40; i += 1) {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (res.ok) {
      healthy = true;
      break;
    }
  } catch {
    /* not up yet */
  }
  await wait(500);
}
check("health endpoint", healthy);
if (!healthy) process.exit(1);

// 1. weak password
const weak = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: { name: "Weak Pass", email: "weak@test.com", password: "abc123", role: "customer" },
});
check("weak password rejected (400)", weak.status === 400, weak);

// 2. no uppercase
const noUpper = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: { name: "No Upper", email: "noupper@test.com", password: "abcdef1", role: "customer" },
});
check("missing uppercase rejected (400)", noUpper.status === 400, noUpper);

// 3. admin role blocked
const adminTry = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: {
    name: "Sneaky",
    email: "sneaky@test.com",
    password: "Sneaky1pass",
    role: "admin",
  },
});
check("admin role blocked on sign-up (400)", adminTry.status === 400, adminTry);

// 4. vendor without business name
const noShop = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: { name: "No Shop", email: "noplace@test.com", password: "Vendor1pass", role: "vendor" },
});
check("vendor without business name rejected (400)", noShop.status === 400, noShop);

// 5. proper vendor sign-up
const vendorEmail = `vendor${Date.now()}@test.com`;
const signup = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: {
    name: "Rahat Vendor",
    email: vendorEmail,
    password: "Vendor1pass",
    role: "vendor",
    businessName: "Rahat Pizza House",
    businessLocation: "Dhanmondi, Dhaka",
  },
});
check("vendor sign-up ok (200)", signup.status === 200, signup);
check("role persisted as vendor", signup.json?.user?.role === "vendor", signup.json?.user);

// 6. exchange session for JWT
const tokenRes = await call("/api/account/token", { method: "POST" });
check("session → jwt exchange (200)", tokenRes.status === 200, tokenRes);
const vendorToken = tokenRes.json?.data?.token;
check("jwt returned", typeof vendorToken === "string" && vendorToken.split(".").length === 3);

// 7. me with jwt (no cookie needed)
const me = await call("/api/account/me", { auth: vendorToken, cookie: false });
check("me with bearer token (200)", me.status === 200, me);
check("me returns vendor role", me.json?.data?.user?.role === "vendor", me.json?.data?.user);

// 8. me without token → 401
const noToken = await call("/api/account/me", { cookie: false });
check("no token → 401", noToken.status === 401, noToken);

// 9. admin login
cookies = new Map();
const adminLogin = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: { email: "pizza@admin.com", password: "000000aA#" },
});
check("admin sign-in (200)", adminLogin.status === 200, adminLogin);

const adminTokenRes = await call("/api/account/token", { method: "POST" });
check("admin session → jwt (200)", adminTokenRes.status === 200, adminTokenRes);
check("admin role in token", adminTokenRes.json?.data?.user?.role === "admin", adminTokenRes.json?.data?.user);

// 10. wrong password
const bad = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: { email: "pizza@admin.com", password: "WrongPass1" },
});
check("wrong password rejected (401)", bad.status === 401, bad);

// 11. duplicate email
const dup = await call("/api/auth/sign-up/email", {
  method: "POST",
  body: { name: "Dup", email: vendorEmail, password: "Vendor1pass", role: "customer" },
});
check("duplicate email rejected (422)", dup.status === 422, dup);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
