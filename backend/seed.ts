import { connectDatabase } from "./src/config/database";
import { User } from "./src/models/User";
import { Organization } from "./src/models/Organization";
import { Vendor } from "./src/models/Vendor";
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function seedDemoData() {
  try {
    await connectDatabase();
    console.log("🌱 Seeding Demo Organization and Users...");

    // 1. Find or create Demo Admin
    let adminUser = await User.findOne({ email: "admin@demo.com" });
    if (!adminUser) {
      adminUser = new User({
        email: "admin@demo.com",
        password: "Demo@12345",
        name: "Demo Admin",
        role: "ORGANIZATION_ADMIN",
        isActive: true,
      });
      await adminUser.save();
      console.log("✓ Created admin@demo.com");
    } else {
      adminUser.password = "Demo@12345";
      adminUser.isActive = true;
      await adminUser.save();
    }

    // 2. Find or create Demo Organization
    let demoOrg = await Organization.findOne({ name: "Acme Corp (Demo)" });
    if (!demoOrg) {
      demoOrg = await Organization.create({
        name: "Acme Corp (Demo)",
        legalName: "Acme Corp Demo Pvt Ltd",
        gstin: "27AABCU9603R1Z2",
        email: "admin@demo.com",
        officialUserId: adminUser._id,
        status: "ACTIVE",
      });
      console.log(`✓ Created demo organization: ${demoOrg.name} (${demoOrg._id})`);
    }

    // Link admin to demoOrg
    if (!adminUser.organizationId || adminUser.organizationId.toString() !== demoOrg._id.toString()) {
      adminUser.organizationId = demoOrg._id as Types.ObjectId;
      await adminUser.save();
    }

    // 3. Find or create Procurement Officer
    let procurementUser = await User.findOne({ email: "procurement@demo.com" });
    if (!procurementUser) {
      procurementUser = new User({
        email: "procurement@demo.com",
        password: "Demo@12345",
        name: "Demo Procurement Officer",
        role: "PROCUREMENT_OFFICER",
        organizationId: demoOrg._id as Types.ObjectId,
        isActive: true,
      });
      await procurementUser.save();
      console.log("✓ Created procurement@demo.com");
    } else {
      procurementUser.password = "Demo@12345";
      procurementUser.organizationId = demoOrg._id as Types.ObjectId;
      procurementUser.isActive = true;
      await procurementUser.save();
      console.log("✓ Updated procurement@demo.com with Demo@12345");
    }

    // 4. Find or create Finance Manager
    let financeUser = await User.findOne({ email: "finance@demo.com" });
    if (!financeUser) {
      financeUser = new User({
        email: "finance@demo.com",
        password: "Demo@12345",
        name: "Demo Finance Manager",
        role: "FINANCE_MANAGER",
        organizationId: demoOrg._id as Types.ObjectId,
        isActive: true,
      });
      await financeUser.save();
      console.log("✓ Created finance@demo.com");
    } else {
      financeUser.password = "Demo@12345";
      financeUser.organizationId = demoOrg._id as Types.ObjectId;
      financeUser.isActive = true;
      await financeUser.save();
      console.log("✓ Updated finance@demo.com with Demo@12345");
    }

    // 5. Update Organization with officer references
    demoOrg.procurementOfficerId = procurementUser._id as Types.ObjectId;
    demoOrg.financeManagerId = financeUser._id as Types.ObjectId;
    await demoOrg.save();

    // 6. Find or create a Demo Vendor
    let vendorUser = await User.findOne({ email: "vendor@demo.com" });
    if (!vendorUser) {
      vendorUser = new User({
        email: "vendor@demo.com",
        password: "Demo@12345",
        name: "TechSupplies Global Rep",
        role: "VENDOR",
        isActive: true,
      });
      await vendorUser.save();
      console.log("✓ Created vendor@demo.com");
    } else {
      vendorUser.password = "Demo@12345";
      vendorUser.isActive = true;
      await vendorUser.save();
      console.log("✓ Updated vendor@demo.com with Demo@12345");
    }

    let demoVendor = await Vendor.findOne({ name: "TechSupplies Global" });
    if (!demoVendor) {
      demoVendor = await Vendor.create({
        userId: vendorUser._id,
        name: "TechSupplies Global",
        email: "billing@techsupplies.com",
        gstin: "29ABCDE1234F1Z5",
        organizationIds: [demoOrg._id],
        status: "ACTIVE",
        isApproved: true,
        totalInvoices: 0,
        totalAmount: 0,
      });
      console.log(`✓ Created demo vendor: ${demoVendor.name}`);
    } else {
      demoVendor.userId = vendorUser._id as Types.ObjectId;
      if (!demoVendor.organizationIds.some(id => id.toString() === demoOrg._id.toString())) {
        demoVendor.organizationIds.push(demoOrg._id as Types.ObjectId);
      }
      await demoVendor.save();
    }

    if (!vendorUser.vendorId || vendorUser.vendorId.toString() !== demoVendor._id.toString()) {
      vendorUser.vendorId = demoVendor._id as Types.ObjectId;
      await vendorUser.save();
    }

    console.log("✅ Demo accounts and organization seeded successfully!");
    console.log("   - Procurement Officer: procurement@demo.com / Demo@12345");
    console.log("   - Finance Manager: finance@demo.com / Demo@12345");
    console.log("   - Org Admin: admin@demo.com / Demo@12345");
  } catch (error) {
    console.error("❌ Seeding error:", error);
    throw error;
  }
}

// When run directly as a script:
if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
