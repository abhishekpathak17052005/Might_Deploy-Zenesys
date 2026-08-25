import { connectDatabase } from "./src/config/database";
import { User } from "./src/models/User";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  try {
    await connectDatabase();
    
    const demoUsers = [
      {
        email: "procurement@demo.com",
        password: "Demo@12345",
        name: "Demo Procurement Officer",
        role: "PROCUREMENT_OFFICER"
      },
      {
        email: "finance@demo.com",
        password: "Demo@12345",
        name: "Demo Finance Manager",
        role: "FINANCE_MANAGER"
      }
    ];

    for (const userData of demoUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        console.log(`Creating demo user: ${userData.email}`);
        await User.create(userData);
      } else {
        console.log(`Demo user already exists: ${userData.email}`);
      }
    }

    console.log("Database seeding completed.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
