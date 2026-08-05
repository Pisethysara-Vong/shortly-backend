import { PrismaClient } from '../../../generated/prisma/client';
import { data } from './url.data';

export class UrlSeeder {
  public static seed = async (prisma: PrismaClient) => {
    try {
      await UrlSeeder.seedUrls(prisma);
    } catch (error) {
      console.error('\x1b[31m\nError seeding url data:', error);
      throw error;
    }
  };

  private static async seedUrls(prisma: PrismaClient) {
    try {
      await prisma.url.createMany({ data: data.urls, skipDuplicates: true });
      console.log('\x1b[32m✓ URLs data inserted successfully.');
    } catch (error) {
      console.error('\x1b[31m\nError seeding urls:', error);
      throw error;
    }
  }
}
