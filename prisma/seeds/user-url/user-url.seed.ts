import { PrismaClient } from '../../../generated/prisma/client';
import { data } from './user-url.data';

export class UserUrlSeeder {
  public static seed = async (prisma: PrismaClient) => {
    try {
      await UserUrlSeeder.seedUserUrls(prisma);
    } catch (error) {
      console.error('\x1b[31m\nError seeding user-url data:', error);
      throw error;
    }
  };

  private static async seedUserUrls(prisma: PrismaClient) {
    try {
      await prisma.userUrl.createMany({ data: data.userUrls, skipDuplicates: true });
      console.log('\x1b[32m✓ User-URL associations data inserted successfully.');
    } catch (error) {
      console.error('\x1b[31m\nError seeding user-url associations:', error);
      throw error;
    }
  }
}
