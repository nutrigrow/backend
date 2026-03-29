require('dotenv').config();
const app = require('./app');
const prisma = require('./config/database');

const PORT = process.env.PORT || 5000;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    await prisma.$disconnect();
    process.exit(0);
};

const startServer = async () => {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err);
    gracefulShutdown('UNHANDLED_REJECTION');
});

startServer();
