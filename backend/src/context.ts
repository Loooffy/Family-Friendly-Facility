import { PrismaClient } from '@prisma/client';

export interface Context {
  prisma: PrismaClient;
}

export function createContext(): Context {
  const prisma = new PrismaClient();
  return { prisma };
}
