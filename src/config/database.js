const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Singleton pattern — prevent multiple Prisma Client instances in development
// (hot-reloading with nodemon would create new instances on each restart)
const globalForPrisma = globalThis;

const createPrismaClient = () => {
    const connectionString = process.env.DATABASE_URL;

    const adapter = new PrismaPg({ connectionString });

    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;
