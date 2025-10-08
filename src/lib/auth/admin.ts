import { prisma } from '@/lib/prisma';

export async function isAdminEmail(email: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  });

  return Boolean(admin);
}
