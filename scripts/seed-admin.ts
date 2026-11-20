import { connectDB } from "../lib/db";
import { User } from "../models/User";
import { env } from "../config/env";

async function seed(): Promise<void> {
  await connectDB();

  const email = env.adminEmail ?? "admin@pizzahub.com";
  const name = "Admin";
  const role = "admin";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (role: ${existing.role})`);
    process.exit(0);
  }

  const admin = await User.create({
    authId: `seed-admin-${Date.now()}`,
    email,
    name,
    role,
    isBlocked: false,
    subscriptionPlan: "free",
  });

  console.log(`✅ Admin seeded: ${admin.email} / id ${admin.id} / role ${admin.role}`);
  console.log("Note: set a real password through the auth signup flow; admin email/password for submission: ", email);
  process.exit(0);
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
