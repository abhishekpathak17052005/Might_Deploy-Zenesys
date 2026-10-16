import { connectDatabase } from "./config/database";
import { User } from "./models/User";
import { Organization } from "./models/Organization";
import { Types } from "mongoose";

async function run() {
  await connectDatabase();

  let adminB = await User.findOne({ email: "admin_beta@demo.com" });
  if (!adminB) {
    adminB = new User({
      email: "admin_beta@demo.com",
      password: "Demo@12345",
      name: "Beta Admin",
      role: "ORGANIZATION_ADMIN",
      isActive: true,
    });
    await adminB.save();
  }

  let orgB = await Organization.findOne({ name: "Beta Industries" });
  if (!orgB) {
    orgB = await Organization.create({
      name: "Beta Industries",
      legalName: "Beta Industries Pvt Ltd",
      gstin: "33AAAAA0000A1Z5",
      email: "admin_beta@demo.com",
      officialUserId: adminB._id as Types.ObjectId,
      status: "ACTIVE",
    });
  }

  adminB.organizationId = orgB._id as Types.ObjectId;
  await adminB.save();

  let userB = await User.findOne({ email: "finance_beta@demo.com" });
  if (!userB) {
    userB = new User({
      email: "finance_beta@demo.com",
      password: "Demo@12345",
      name: "Beta Finance Manager",
      role: "FINANCE_MANAGER",
      organizationId: orgB._id as Types.ObjectId,
      isActive: true,
    });
    await userB.save();
  } else {
    userB.password = "Demo@12345";
    userB.organizationId = orgB._id as Types.ObjectId;
    userB.isActive = true;
    await userB.save();
  }
  console.log("✓ Org B test users ready: admin_beta@demo.com & finance_beta@demo.com / Demo@12345");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
