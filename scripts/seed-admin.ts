import { getAuth } from "../src/lib/auth.js";
import { connectDB, disconnectDB } from "../src/lib/db.js";
import { User } from "../src/models/User.js";

/**
 * Admin accounts are never creatable through the public sign-up form.
 * This script is the only way one is born.
 *
 *   npm run seed
 *
 * Running it twice is safe: it promotes the existing account instead of
 * creating a duplicate.
 */
const ADMIN = {
  name: "PizzaHub Admin",
  email: "pizza@admin.com",
  password: "000000aA#",
} as const;

async function main(): Promise<void> {
  await connectDB();

  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    existing.role = "admin";
    existing.emailVerified = true;
    await existing.save();
    console.log(`✓ ${ADMIN.email} already existed — role set to admin`);
    return;
  }

  // Created through Better Auth so the password is hashed exactly the way
  // the sign-in endpoint expects. The hook forces `customer`, so the
  // promotion happens right after.
  await getAuth().api.signUpEmail({
    body: {
      name: ADMIN.name,
      email: ADMIN.email,
      password: ADMIN.password,
      role: "customer",
    },
  });

  const admin = await User.findOneAndUpdate(
    { email: ADMIN.email },
    { $set: { role: "admin", emailVerified: true } },
    { new: true },
  );

  if (!admin) throw new Error("Better Auth created the account but no user document was found");

  console.log("✓ admin seeded");
  console.log(`   email:    ${ADMIN.email}`);
  console.log(`   password: ${ADMIN.password}`);
  console.log(`   id:       ${admin._id.toString()}`);
}

main()
  .catch((error: unknown) => {
    console.error("✖ Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
