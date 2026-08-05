import { PrismaClient } from '../../../generated/prisma/client';
import { data } from './user.data';

export class UserSeeder {
  public static seed = async (prisma: PrismaClient) => {
    try {
      await UserSeeder.seedUsers(prisma);
    } catch (error) {
      console.error('\x1b[31m\nError seeding user data:', error);
      throw error;
    }
  };

  private static async seedUsers(prisma: PrismaClient) {
    try {
      await prisma.user.createMany({ data: data.users, skipDuplicates: true });
      console.log('\x1b[32m✓ Users data inserted successfully.');
    } catch (error) {
      console.error('\x1b[31m\nError seeding users:', error);
      throw error;
    }
  }
}
