const BASE = "http://localhost:5000";
const ORIGIN = "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, cookies: res.headers.getSetCookie?.() ?? [] };
}

// 1x1 transparent PNG
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

console.log("--- google start ---");
const google = await post("/api/auth/sign-in/social", {
  provider: "google",
  callbackURL: "http://localhost:3000/dashboard",
  disableRedirect: true,
});
console.log("status:", google.status);
console.log("url host:", google.json?.url ? new URL(google.json.url).host : google.json);
console.log("state cookie set:", google.cookies.length > 0);
console.log("callbackUrl param:", google.json?.url ? new URL(google.json.url).searchParams.get("redirect_uri") : "-");

console.log("\n--- imgbb upload ---");
const upload = await post("/api/upload", { image: `data:image/png;base64,${PNG}` });
console.log("status:", upload.status);
console.log("payload:", JSON.stringify(upload.json).slice(0, 400));

console.log("\n--- upload rejects junk ---");
const junk = await post("/api/upload", { image: "not-an-image" });
console.log("status:", junk.status);
