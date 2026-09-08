import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DB_URL_NON_POOLING || process.env.DB_PRISMA_URL;
  if (!connectionString) {
    throw new Error("No database URL set");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    console.log("Updating staff names in database...");
    await prisma.user.updateMany({
      where: { email: "admin@example.com" },
      data: { name: "Shubham Pawar" },
    });
    await prisma.user.updateMany({
      where: { email: "senior@example.com" },
      data: { name: "Vikrant Sharma" },
    });
    await prisma.user.updateMany({
      where: { email: "associate@example.com" },
      data: { name: "Sneha Patel" },
    });
    await prisma.user.updateMany({
      where: { email: "paralegal@example.com" },
      data: { name: "Roshni Verma" },
    });

    console.log("Updating case client names in database...");
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/CS/1101/2026" },
      data: {
        title: "Singhania Textiles v. Kaveri Logistics",
        clientName: "Aditya Singhania",
      },
    });
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/CRL/2204/2026" },
      data: {
        title: "State v. Rajesh Malhotra (Bail Application)",
        clientName: "Rajesh Malhotra",
      },
    });
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/CORP/3307/2026" },
      data: {
        title: "Northwind Tech Infra — Scheme of Amalgamation",
        clientName: "Northwind Tech Infra Pvt Ltd",
      },
    });
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/FAM/4412/2026" },
      data: {
        title: "In re: Guardianship of Aarav (Custody Petition)",
        clientName: "Ananya Iyer",
      },
    });
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/CS/5518/2025" },
      data: {
        title: "Ashcroft Realty Developers — Title Dispute",
        clientName: "Ashcroft Realty Developers LLP",
      },
    });
    await prisma.case.updateMany({
      where: { caseNumber: "SAMPLE/CORP/6621/2026" },
      data: {
        title: "Blue Harbour Capital — International Commercial Arbitration",
        clientName: "Blue Harbour Capital Partners",
      },
    });

    const users = await prisma.user.findMany({ select: { name: true, email: true, role: true } });
    console.log("Updated Staff List:", users);

    const cases = await prisma.case.findMany({ select: { caseNumber: true, title: true, clientName: true } });
    console.log("Updated Cases List:", cases);

    console.log("Done updating staff names and client names!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
