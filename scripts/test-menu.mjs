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

async function signIn(email, password) {
  cookies = new Map();
  await call("/api/auth/sign-in/email", { method: "POST", body: { email, password } });
  const t = await call("/api/account/token", { method: "POST" });
  globalThis.__token = t.json?.data?.token;
  return t.json?.data?.user;
}

console.log("=== admin sign-in ===");
const admin = await signIn("pizza@admin.com", "000000aA#");
console.log("admin:", admin?.email, admin?.role);

console.log("\n=== vendor sign-up ===");
const vEmail = `vendor${Date.now()}@test.com`;
await call("/api/auth/sign-up/email", { method: "POST", body: { name: "Test Vendor", email: vEmail, password: "Vendor1pass", role: "vendor", businessName: "Test Pizza Co" } });
const vToken = await call("/api/account/token", { method: "POST" });
globalThis.__token = vToken.json?.data?.token;
const vendor = vToken.json?.data?.user;
console.log("vendor:", vendor?.email, vendor?.role);

console.log("\n=== create items ===");
const items = [
  { itemName: "Margherita", description: "Classic tomato and mozzarella", category: "Classic Pizzas", price: 8.5, location: "Dhanmondi", images: [] },
  { itemName: "Pepperoni", description: "Spicy pepperoni", category: "Meat Lovers", price: 10.0, location: "Gulshan", images: [] },
  { itemName: "Veggie Supreme", description: "Loaded vegetables", category: "Vegetarian", price: 9.0, location: "Banani", images: [] },
  { itemName: "Hawaiian", description: "Ham and pineapple", category: "Specialty / Gourmet", price: 11.5, location: "Dhanmondi", images: [] },
];
const created = [];
for (const it of items) {
  const r = await call("/api/menu", { method: "POST", body: it });
  console.log(`  ${it.itemName}: ${r.status} ${r.json?.message || r.json?.data?.status}`);
  if (r.json?.data?.id) created.push(r.json.data);
}

console.log("\n=== free plan limit (4th item) ===");
const r4 = await call("/api/menu", { method: "POST", body: items[3] });
console.log(`  4th item: ${r4.status} ${r4.json?.message}`);

console.log("\n=== admin approves ===");
globalThis.__token = await (async () => { cookies = new Map(); await call("/api/auth/sign-in/email", { method: "POST", body: { email: "pizza@admin.com", password: "000000aA#" } }); const t = await call("/api/account/token", { method: "POST" }); return t.json?.data?.token; })();
for (const it of created.slice(0, 3)) {
  const r = await call(`/api/menu/${it.id}/moderate`, { method: "PATCH", body: { status: "approved" } });
  console.log(`  ${it.itemName}: ${r.status} ${r.json?.data?.status}`);
}

console.log("\n=== public browse ===");
globalThis.__token = null;
cookies = new Map();
let r = await call("/api/menu");
console.log("default (newest):", r.json?.data?.items?.length, "items, total:", r.json?.data?.pagination?.total);

r = await call("/api/menu?sort=priceAsc");
console.log("priceAsc:", r.json?.data?.items?.map(i => `${i.itemName}(${i.price})`).join(", "));

r = await call("/api/menu?sort=priceDesc");
console.log("priceDesc:", r.json?.data?.items?.map(i => `${i.itemName}(${i.price})`).join(", "));

r = await call("/api/menu?search=margherita");
console.log("search 'margherita':", r.json?.data?.items?.map(i => i.itemName).join(", "));

r = await call("/api/menu?category=Vegetarian");
console.log("category Vegetarian:", r.json?.data?.items?.map(i => i.itemName).join(", "));

r = await call("/api/menu?minPrice=9&maxPrice=10.5");
console.log("price 9-10.5:", r.json?.data?.items?.map(i => `${i.itemName}(${i.price})`).join(", "));

r = await call("/api/menu?location=Dhanmondi");
console.log("location Dhanmondi:", r.json?.data?.items?.map(i => i.itemName).join(", "));

r = await call("/api/menu/categories");
console.log("\ncategories:", JSON.stringify(r.json?.data));

const firstId = (await call("/api/menu")).json?.data?.items?.[0]?.id;
r = await call(`/api/menu/${firstId}`);
console.log("\nitem detail:", r.json?.data?.itemName, "rating:", r.json?.data?.ratingAvg);

console.log("\n=== customer review ===");
await call("/api/auth/sign-up/email", { method: "POST", body: { name: "Test Customer", email: `cust${Date.now()}@test.com`, password: "CustPass1", role: "customer" } });
const cToken = await call("/api/account/token", { method: "POST" });
globalThis.__token = cToken.json?.data?.token;
r = await call(`/api/menu/${firstId}/reviews`, { method: "POST", body: { rating: 5, comment: "Amazing pizza!" } });
console.log("review:", r.status, r.json?.data);

r = await call(`/api/menu/${firstId}`);
console.log("after review rating:", r.json?.data?.ratingAvg, "count:", r.json?.data?.ratingCount, "reviews:", r.json?.data?.reviews?.length);

console.log("\n=== cleanup ===");
globalThis.__token = vToken.json?.data?.token;
const vendorItems = (await call("/api/menu?limit=48")).json?.data?.items ?? [];
for (const it of vendorItems) {
  await call(`/api/menu/${it.id}`, { method: "DELETE" });
}
console.log("deleted vendor items");
