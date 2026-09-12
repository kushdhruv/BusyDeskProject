import { prisma } from "../db/prisma.db";

async function main() {
  const ext: any[] = await prisma.$queryRaw`SELECT extname, extversion FROM pg_extension;`;
  console.log("Installed extensions:", ext);
  await prisma.$disconnect();
}

main().catch(console.error);
