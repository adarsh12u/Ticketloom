import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for seeding");
  }

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    throw new Error("SEED_USER_PASSWORD is required for seeding (do not hardcode passwords)");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  const email = "owner@ticketloom.local";
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Dev Owner",
      firstName: "Dev",
      lastName: "Owner",
      passwordHash,
      emailVerified: new Date(),
    },
    create: {
      email,
      name: "Dev Owner",
      firstName: "Dev",
      lastName: "Owner",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  let organization = await prisma.organization.findUnique({
    where: { slug: "ticketloom-dev" },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: "Ticketloom Development",
        slug: "ticketloom-dev",
      },
    });
  }

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { activeOrganizationId: organization.id },
  });

  console.info("Seeded development owner:", email);
  console.info("Organization:", organization.slug);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
