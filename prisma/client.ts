import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient;

function initializePrisma(): PrismaClient {
  if (prisma) return prisma;

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    // Add pool config to handle Render cold starts
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

  return prisma;
}

export const prismaClient = initializePrisma();

// Warm up the connection on module load
prismaClient
  .$connect()
  .then(() => console.log('✅ Prisma connected'))
  .catch((err) => console.error('❌ Prisma connection failed:', err));

export async function disconnectPrisma() {
  if (prisma) await prisma.$disconnect();
}
