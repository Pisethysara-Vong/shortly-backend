import { PrismaClient } from '../../../generated/prisma/client';
import { data } from './auth-account.data';

export class AuthAccountSeeder {
  public static seed = async (prisma: PrismaClient) => {
    try {
      await AuthAccountSeeder.seedAuthAccounts(prisma);
    } catch (error) {
      console.error('\x1b[31m\nError seeding auth account data:', error);
      throw error;
    }
  };

  private static async seedAuthAccounts(prisma: PrismaClient) {
    try {
      await prisma.authAccount.createMany({ data: data.authAccounts, skipDuplicates: true });
      console.log('\x1b[32m✓ Auth accounts data inserted successfully.');
    } catch (error) {
      console.error('\x1b[31m\nError seeding auth accounts:', error);
      throw error;
    }
  }
}
