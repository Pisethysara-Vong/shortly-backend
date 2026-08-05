// ============================================================================
// PRISMA SEED FILE
// File: prisma/seed.ts
// ============================================================================
// This file orchestrates seeding data for all tables in the database.
// Run with: npx prisma db seed
// ============================================================================

import 'dotenv/config';
import { prismaClient } from './client';
import { UserSeeder } from './seeds/user/user.seed';
import { AuthAccountSeeder } from './seeds/auth-account/auth-account.seed';
import { UrlSeeder } from './seeds/url/url.seed';
import { UserUrlSeeder } from './seeds/user-url/user-url.seed';


// ============================================================================
// CLEANUP: Delete all data in reverse dependency order
// ============================================================================
async function cleanup() {
  console.log('\n\x1b[33m🧹 Cleaning up existing data...\x1b[0m');
  console.log('─'.repeat(60));

  try {
    // Delete in reverse order of dependencies
    await prismaClient.userUrl.deleteMany({});
    console.log('✓ Cleared user-url associations');

    await prismaClient.url.deleteMany({});
    console.log('✓ Cleared urls');

    await prismaClient.authAccount.deleteMany({});
    console.log('✓ Cleared auth accounts');

    await prismaClient.user.deleteMany({});
    console.log('✓ Cleared users');

    console.log('\x1b[32m✅ Cleanup completed successfully!\x1b[0m');
  } catch (error) {
    console.error('\x1b[31m❌ Error during cleanup:\x1b[0m', error);
    throw error;
  }
}

async function main() {
  console.log('\x1b[36m%s\x1b[0m', '\n🌱 Starting database seeding...\n');
  console.log('═'.repeat(60));

  try {
    await cleanup();

    // ========================================================================
    // PHASE 1: Core Users & Authentication
    // ========================================================================
    console.log('\n\x1b[33m📦 Phase 1: Seeding Users & Authentication\x1b[0m');
    console.log('─'.repeat(60));

    await UserSeeder.seed(prismaClient);
    await AuthAccountSeeder.seed(prismaClient);

    // ========================================================================
    // PHASE 2: URLs
    // ========================================================================
    console.log('\n\x1b[33m📦 Phase 2: Seeding URLs\x1b[0m');
    console.log('─'.repeat(60));

    await UrlSeeder.seed(prismaClient);

    // ========================================================================
    // PHASE 3: User-URL Associations (Depends on Users & URLs)
    // ========================================================================
    console.log('\n\x1b[33m📦 Phase 3: Seeding User-URL Associations\x1b[0m');
    console.log('─'.repeat(60));

    await UserUrlSeeder.seed(prismaClient);

    // ========================================================================
    // Success Summary
    // ========================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('\x1b[32m%s\x1b[0m', '✅ Database seeding completed successfully!\n');

    // Print summary statistics
    await printSeedingSummary();

  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('\x1b[31m%s\x1b[0m', '❌ Error during database seeding:');
    console.error(error);
    console.error('═'.repeat(60) + '\n');
    process.exit(1);
  } finally {
    await prismaClient.$disconnect();
  }
}

// ============================================================================
// Helper: Print Seeding Summary
// ============================================================================
async function printSeedingSummary() {
  try {
    const stats = await Promise.all([
      prismaClient.user.count(),
      prismaClient.authAccount.count(),
      prismaClient.url.count(),
      prismaClient.userUrl.count(),
    ]);

    console.log('\x1b[36m%s\x1b[0m', '\n📊 Seeding Summary:');
    console.log('─'.repeat(60));
    console.log(`  👤 Users:               ${stats[0]}`);
    console.log(`  🔐 Auth Accounts:       ${stats[1]}`);
    console.log(`  🔗 URLs:                ${stats[2]}`);
    console.log(`  🔗 User-URL Links:      ${stats[3]}`);
    console.log('─'.repeat(60));
    console.log(`  📝 Total Records:       ${stats.reduce((a, b) => a + b, 0)}\n`);
  } catch (error) {
    console.error('Error printing summary:', error);
  }
}

// ============================================================================
// Execute Main Function
// ============================================================================
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });