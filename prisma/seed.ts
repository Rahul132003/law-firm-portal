/**
 * Development seed.
 *
 * SECURITY: this script contains NO hardcoded credentials. It provisions four
 * placeholder staff accounts on the reserved `example.com` domain and mints a
 * fresh random password for each one at run time, printing them once to the
 * terminal.
 *
 * These accounts are development scaffolding. They MUST be deleted or have
 * their passwords rotated before this portal is deployed. The script refuses
 * to run against a production environment unless explicitly overridden.
 *
 * Run with:  npx prisma db seed
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseKey, seal } from "../src/lib/field-cipher";

const BCRYPT_ROUNDS = 12;

/**
 * Same envelope as `encryptField` in src/lib/crypto.ts. That module is marked
 * `server-only` and cannot load in a plain Node script, so this uses the
 * shared cipher it is built on.
 */
function encryptField(plaintext: string): string {
  return seal(plaintext, parseKey(process.env.FIELD_ENCRYPTION_KEY ?? ""));
}

/** Reserved by RFC 2606 — can never be a real firm domain. */
const PLACEHOLDER_DOMAIN = "example.com";

const PLACEHOLDER_STAFF = [
  {
    key: "partner",
    name: "Shubham Pawar",
    email: `admin@${PLACEHOLDER_DOMAIN}`,
    role: "ADMIN_PARTNER",
  },
  {
    key: "senior",
    name: "Vikrant Sharma",
    email: `senior@${PLACEHOLDER_DOMAIN}`,
    role: "SENIOR_ADVOCATE",
  },
  {
    key: "associate",
    name: "Sneha Patel",
    email: `associate@${PLACEHOLDER_DOMAIN}`,
    role: "ASSOCIATE",
  },
  {
    key: "paralegal",
    name: "Roshni Verma",
    email: `paralegal@${PLACEHOLDER_DOMAIN}`,
    role: "PARALEGAL",
  },
] as const;

/** URL-safe, 18 bytes of entropy. Never reused, never written to disk. */
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

function assertNotProduction() {
  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (isProd && process.env.ALLOW_PRODUCTION_SEED !== "yes-i-am-sure") {
    throw new Error(
      "Refusing to seed placeholder accounts into a production environment.\n" +
      "These are development-only credentials. If you genuinely intend this, " +
      "set ALLOW_PRODUCTION_SEED=yes-i-am-sure.",
    );
  }
}

/**
 * Sample matters. Entirely fictional — every case number is prefixed
 * `SAMPLE/` and no party, client or judge names refer to real people.
 *
 * The assignment spread is deliberate: it exercises each visibility rule.
 * `assignTo` names are the local-parts of the placeholder staff emails.
 */
const SAMPLE_CASES = [
  {
    caseNumber: "SAMPLE/CS/1101/2026",
    title: "Singhania Textiles v. Kaveri Logistics",
    clientName: "Aditya Singhania",
    caseType: "CIVIL",
    court: "High Court of Delhi",
    jurisdiction: "New Delhi",
    judge: "Hon'ble Justice A. Sharma",
    opposingParty: "Kaveri Logistics Pvt Ltd",
    opposingCounsel: "Fictional & Partners",
    status: "UNDER_TRIAL",
    assignTo: [["senior", "LEAD_COUNSEL"], ["associate", "CO_COUNSEL"]],
  },
  {
    caseNumber: "SAMPLE/CRL/2204/2026",
    title: "State v. Rajesh Malhotra (Bail Application)",
    clientName: "Rajesh Malhotra",
    caseType: "CRIMINAL",
    court: "Sessions Court, Bengaluru",
    jurisdiction: "Bengaluru Urban",
    judge: "Hon'ble Judge B. R. Hegde",
    opposingParty: "State of Karnataka",
    opposingCounsel: "Office of the Public Prosecutor",
    status: "FILED",
    assignTo: [["associate", "LEAD_COUNSEL"], ["paralegal", "PARALEGAL"]],
  },
  {
    caseNumber: "SAMPLE/CORP/3307/2026",
    title: "Northwind Tech Infra — Scheme of Amalgamation",
    clientName: "Northwind Tech Infra Pvt Ltd",
    caseType: "CORPORATE",
    court: "NCLT, Mumbai Bench",
    jurisdiction: "Mumbai",
    judge: "Hon'ble Member Technical V. Rao",
    opposingParty: "Regional Director (WR)",
    opposingCounsel: "Central Govt Standing Counsel",
    status: "JUDGMENT",
    assignTo: [["partner", "LEAD_COUNSEL"]],
  },
  {
    caseNumber: "SAMPLE/FAM/4412/2026",
    title: "In re: Guardianship of Aarav (Custody Petition)",
    clientName: "Ananya Iyer",
    caseType: "FAMILY",
    court: "Family Court, Chennai",
    jurisdiction: "Chennai",
    judge: "Hon'ble Judge K. Sundaram",
    opposingParty: "Vikram Iyer",
    opposingCounsel: "Apex Legal Chambers",
    status: "APPEAL",
    assignTo: [["senior", "LEAD_COUNSEL"], ["paralegal", "PARALEGAL"]],
  },
  {
    caseNumber: "SAMPLE/CS/5518/2025",
    title: "Ashcroft Realty Developers — Title Dispute",
    clientName: "Ashcroft Realty Developers LLP",
    caseType: "CIVIL",
    court: "High Court of Delhi",
    jurisdiction: "New Delhi",
    judge: "Hon'ble Justice D. K. Sengupta",
    opposingParty: "Municipal Corporation of Delhi",
    opposingCounsel: "Civic Legal Cell",
    status: "CLOSED",
    assignTo: [["partner", "LEAD_COUNSEL"], ["senior", "CO_COUNSEL"]],
  },
  {
    caseNumber: "SAMPLE/CORP/6621/2026",
    title: "Blue Harbour Capital — International Commercial Arbitration",
    clientName: "Blue Harbour Capital Partners",
    caseType: "CORPORATE",
    court: "Arbitration Tribunal, Mumbai",
    jurisdiction: "Mumbai",
    judge: "Arbitral Tribunal (Presiding Arbitrator)",
    opposingParty: "Cedar Point Industries Global",
    opposingCounsel: "Lex & Juris Associates",
    status: "UNDER_TRIAL",
    // Partner-only: proves an associate cannot see unassigned matters.
    assignTo: [["partner", "LEAD_COUNSEL"]],
  },
  {
    caseNumber: "SAMPLE/CS/7732/2026",
    title: "Oberoi Hospitality v. Apex Constructions",
    clientName: "Karan Oberoi",
    caseType: "CIVIL",
    court: "City Civil Court, Hyderabad",
    jurisdiction: "Hyderabad",
    judge: "Hon'ble Judge P. N. Reddy",
    opposingParty: "Apex Constructions Pvt Ltd",
    opposingCounsel: "Hyderabad Law Chambers",
    status: "FILED",
    assignTo: [["senior", "LEAD_COUNSEL"], ["associate", "CO_COUNSEL"]],
  },
  {
    caseNumber: "SAMPLE/CORP/8845/2026",
    title: "Krishnan BioTech — Trademark & Patent Enforcement",
    clientName: "Meera Krishnan",
    caseType: "CORPORATE",
    court: "High Court of Bombay",
    jurisdiction: "Mumbai",
    judge: "Hon'ble Justice R. F. Nariman Bench",
    opposingParty: "BioGeneric Labs India",
    opposingCounsel: "IP Counsel Group",
    status: "UNDER_TRIAL",
    assignTo: [["partner", "LEAD_COUNSEL"], ["associate", "CO_COUNSEL"]],
  },
] as const;

async function seedSampleCases(prisma: PrismaClient): Promise<number> {
  const staff = await prisma.user.findMany({
    where: { email: { endsWith: `@${PLACEHOLDER_DOMAIN}` } },
    select: { id: true, email: true },
  });

  const idFor = (key: string) =>
    staff.find((s) => s.email === `${key}@${PLACEHOLDER_DOMAIN}`)?.id;

  for (const sample of SAMPLE_CASES) {
    const { assignTo, ...fields } = sample;

    const record = await prisma.case.upsert({
      where: { caseNumber: fields.caseNumber },
      update: {
        title: fields.title,
        clientName: fields.clientName,
        caseType: fields.caseType,
        court: fields.court,
        jurisdiction: fields.jurisdiction,
        judge: fields.judge,
        opposingParty: fields.opposingParty,
        opposingCounsel: fields.opposingCounsel,
        status: fields.status,
      },
      create: { ...fields, filedOn: new Date("2026-01-15") },
      select: { id: true },
    });

    for (const [key, roleOnCase] of assignTo) {
      const userId = idFor(key);
      if (!userId) continue;
      await prisma.caseAssignment.upsert({
        where: { caseId_userId: { caseId: record.id, userId } },
        update: { roleOnCase },
        create: { caseId: record.id, userId, roleOnCase },
      });
    }
  }

  // Two notes on the criminal matter, which the paralegal is assigned to.
  // The STRATEGY one must not be visible to them — that is the carve-out.
  const criminal = await prisma.case.findUnique({
    where: { caseNumber: "SAMPLE/CRL/2204/2026" },
    select: { id: true, notes: { select: { id: true } } },
  });
  const associateId = idFor("associate");

  if (criminal && associateId && criminal.notes.length === 0) {
    await prisma.caseNote.createMany({
      data: [
        {
          caseId: criminal.id,
          authorId: associateId,
          body: encryptField(
            "Client interview scheduled. Collect the bank statements and the courier receipts before the next date.",
          ),
          visibility: "CASE_TEAM",
        },
        {
          caseId: criminal.id,
          authorId: associateId,
          body: encryptField(
            "STRATEGY: challenge the chain of custody on the seized material; the seizure memo is unsigned. Do not discuss outside counsel.",
          ),
          visibility: "STRATEGY",
        },
      ],
    });
  }

  return SAMPLE_CASES.length;
}

async function main() {
  assertNotProduction();

  const connectionString = process.env.DB_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("DB_URL_NON_POOLING is not set. See .env.example.");
  }

  // Mirrors the connection branching in src/lib/prisma.ts so the seed works
  // against both `prisma dev` and a real Postgres instance.
  const prisma =
    connectionString.startsWith("prisma+postgres://") ||
      connectionString.startsWith("prisma://")
      ? new PrismaClient({ accelerateUrl: connectionString })
      : new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const issued: Array<{ email: string; role: string; password: string }> = [];
  const preserved: Array<{ email: string; role: string }> = [];

  try {
    for (const staff of PLACEHOLDER_STAFF) {
      const existing = await prisma.user.findUnique({
        where: { email: staff.email },
        select: { id: true },
      });

      if (existing) {
        // Deliberately does NOT touch passwordHash. Rotating on every seed
        // run silently invalidates a password someone is already using —
        // use `npm run user:password` to set one on purpose.
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: staff.name, role: staff.role, isActive: true },
        });
        preserved.push({ email: staff.email, role: staff.role });
        continue;
      }

      const password = generatePassword();
      await prisma.user.create({
        data: {
          name: staff.name,
          email: staff.email,
          passwordHash: await hash(password, BCRYPT_ROUNDS),
          role: staff.role,
        },
      });

      issued.push({ email: staff.email, role: staff.role, password });
    }

    // Put the associate and the paralegal under the senior advocate, so the
    // team-visibility rule has something to exercise.
    const senior = await prisma.user.findUnique({
      where: { email: `senior@${PLACEHOLDER_DOMAIN}` },
      select: { id: true },
    });

    if (senior) {
      await prisma.user.updateMany({
        where: {
          email: {
            in: [
              `associate@${PLACEHOLDER_DOMAIN}`,
              `paralegal@${PLACEHOLDER_DOMAIN}`,
            ],
          },
        },
        data: { supervisorId: senior.id },
      });
    }

    const caseCount = await seedSampleCases(prisma);

    console.log(`\n  Sample matters: ${caseCount} (all fictional).\n`);

    if (issued.length > 0) {
      console.log(
        `  Created ${issued.length} PLACEHOLDER staff account(s).\n` +
        "  ┌─ These passwords are shown once and are not stored anywhere ─┐\n",
      );
      for (const account of issued) {
        console.log(`    ${account.role.padEnd(16)} ${account.email}`);
        console.log(`    ${" ".repeat(16)} ${account.password}\n`);
      }
    }

    if (preserved.length > 0) {
      console.log(
        `  ${preserved.length} account(s) already existed — passwords left UNCHANGED:`,
      );
      for (const account of preserved) {
        console.log(`    ${account.role.padEnd(16)} ${account.email}`);
      }
      console.log(
        '\n  To set one deliberately:\n' +
        '    npm run user:password -- <email> "<new password>"\n',
      );
    }

    console.log(
      "  MUST BE CHANGED BEFORE DEPLOY — delete these accounts or rotate\n" +
      "  their passwords before this portal handles real matter data.\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
