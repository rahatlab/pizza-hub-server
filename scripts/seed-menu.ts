import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { MenuItem } from "../src/models/MenuItem.js";

await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });

let vendor = await User.findOne({ email: "vendor@demo.com" });
if (!vendor) {
  vendor = await User.create({
    name: "Demo Vendor",
    email: "vendor@demo.com",
    role: "vendor",
    businessName: "Demo Pizza House",
    businessLocation: "Dhanmondi, Dhaka",
    plan: "premium",
    emailVerified: true,
  });
}

const items = [
  { itemName: "Margherita", description: "Classic tomato, mozzarella and basil", category: "Classic Pizzas", price: 8.5, location: "Dhanmondi", images: [] },
  { itemName: "Pepperoni", description: "Spicy pepperoni with extra cheese", category: "Meat Lovers", price: 10.0, location: "Gulshan", images: [] },
  { itemName: "Veggie Supreme", description: "Loaded with bell peppers, olives and mushrooms", category: "Vegetarian", price: 9.0, location: "Banani", images: [] },
  { itemName: "Hawaiian", description: "Ham and pineapple on a thin crust", category: "Specialty / Gourmet", price: 11.5, location: "Dhanmondi", images: [] },
  { itemName: "Garlic Bread", description: "Toasted garlic bread with herbs", category: "Sides & Appetizers", price: 3.5, location: "Gulshan", images: [] },
  { itemName: "Tiramisu", description: "Classic Italian dessert", category: "Beverages & Desserts", price: 5.0, location: "Banani", images: [] },
];

await MenuItem.deleteMany({ vendorId: vendor._id });
for (const it of items) {
  await MenuItem.create({ ...it, vendorId: vendor._id, status: "approved" });
}
console.log(`seeded ${items.length} approved menu items for ${vendor.email}`);
await mongoose.disconnect();
