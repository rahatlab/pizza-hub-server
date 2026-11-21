const BASE = "http://localhost:5000";
const ORIGIN = "http://localhost:3000";

let cookies = new Map();
function jar() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
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
async function call(path, { method = "GET", body, auth = true, cookie = true } = {}) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth && globalThis.__token) headers.authorization = `Bearer ${globalThis.__token}`;
  if (cookie && cookies.size) headers.cookie = jar();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "include" });
  storeCookies(res);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

console.log("=== sign in as vendor ===");
cookies = new Map();
await call("/api/auth/sign-in/email", { method: "POST", body: { email: "vendor@demo.com", password: "Vendor1pass" } });
const tok = await call("/api/account/token", { method: "POST" });
globalThis.__token = tok.json?.data?.token;
console.log("vendor:", tok.json?.data?.user?.email, tok.json?.data?.user?.plan);

console.log("\n=== stripe status ===");
const status = await call("/api/stripe/status");
console.log("configured:", status.json?.data?.configured);

console.log("\n=== create checkout session ===");
const checkout = await call("/api/stripe/checkout", { method: "POST" });
console.log("status:", checkout.status);
console.log("url:", checkout.json?.data?.url?.slice(0, 80));
console.log("sessionId:", checkout.json?.data?.sessionId);
EOF