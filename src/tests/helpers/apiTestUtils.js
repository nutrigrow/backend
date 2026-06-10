import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { vi } from 'vitest';

const require = createRequire(import.meta.url);
const testSigningKey = randomBytes(32).toString('hex');

export const testUsers = {
  user: {
    id: 7,
    nama: 'Bunda Test',
    email: 'bunda@example.com',
    role: 'USER',
    avatarUrl: null,
    isActive: true,
    deletedAt: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  admin: {
    id: 1,
    nama: 'Admin Test',
    email: 'admin@example.com',
    role: 'ADMIN',
    avatarUrl: null,
    isActive: true,
    deletedAt: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  inactive: {
    id: 99,
    nama: 'Inactive Test',
    email: 'inactive@example.com',
    role: 'USER',
    avatarUrl: null,
    isActive: false,
    deletedAt: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

export const serviceMethodNames = {
  auth: [
    'register',
    'login',
    'verifyEmail',
    'googleAuth',
    'refreshAccessToken',
    'logout',
    'forgotPassword',
    'resetPassword',
    'changePassword',
    'getMe',
    'updateMe',
  ],
  nutrishop: [
    'getProducts',
    'getProductById',
    'addProduct',
    'getCart',
    'addToCart',
    'updateCartItemQuantity',
    'deleteCartItem',
    'addAddress',
    'getAddresses',
    'checkoutCart',
    'checkoutDirect',
    'getOrders',
    'getOrderById',
    'syncOrderPaymentStatus',
    'createPaymentForOrder',
    'handleMidtransWebhook',
  ],
  children: [
    'getAllChildren',
    'createChild',
    'getChildById',
    'updateChild',
    'deleteChild',
    'getChildName',
    'createGrowthRecord',
    'updateGrowthRecord',
    'deleteGrowthRecord',
    'getLatestGrowth',
    'getBmiChart',
    'getPercentile',
  ],
  healthLog: [
    'createOrUpdateLog',
    'getTodayLog',
    'getAllLogs',
    'getInsight',
    'getNotifications',
  ],
  specialist: ['getAllSpecialists', 'getSpecialistById'],
  consultation: [
    'getAvailability',
    'createBooking',
    'getMyConsultations',
    'reschedule',
    'cancel',
    'confirmPayment',
  ],
  article: ['getArticles', 'getArticleById', 'getRelatedArticles'],
  admin: [
    'getDashboard',
    'getUsers',
    'setUserActive',
    'deleteUser',
    'getProducts',
    'createProduct',
    'updateProduct',
    'deleteProduct',
    'getNutritionists',
    'createNutritionist',
    'updateNutritionist',
    'deleteNutritionist',
    'getArticles',
    'createArticle',
    'updateArticle',
    'deleteArticle',
    'getShopOrders',
    'updateShopOrderStatus',
    'getConsultations',
    'updateConsultation',
  ],
};

export const createServiceMocks = () =>
  Object.fromEntries(
    Object.entries(serviceMethodNames).map(([serviceName, methods]) => [
      serviceName,
      Object.fromEntries(methods.map((method) => [method, vi.fn()])),
    ]),
  );

export const createAccessToken = (user = testUsers.user) =>
  jwt.sign({ sub: user.id, type: 'access' }, testSigningKey, { expiresIn: '1h' });

export const createRefreshToken = (user = testUsers.user) =>
  jwt.sign({ sub: user.id, type: 'refresh' }, testSigningKey, { expiresIn: '7d' });

export const bearer = (token) => `Bearer ${token}`;

export const ApiError = require('../../utils/ApiError');

const clearBackendCache = () => {
  const srcMarker = `${path.sep}backend${path.sep}src${path.sep}`;
  const testsMarker = `${path.sep}backend${path.sep}src${path.sep}tests${path.sep}`;

  for (const key of Object.keys(require.cache)) {
    if (key.includes(srcMarker) && !key.includes(testsMarker)) {
      delete require.cache[key];
    }
  }
};

const mockCjsModule = (moduleId, exports) => {
  const resolved = require.resolve(moduleId);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

const passThroughMiddleware = (_req, _res, next) => next();

export const createApiTestContext = ({ users = {}, services = createServiceMocks() } = {}) => {
  clearBackendCache();

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = testSigningKey;

  const usersById = {
    [testUsers.user.id]: testUsers.user,
    [testUsers.admin.id]: testUsers.admin,
    [testUsers.inactive.id]: testUsers.inactive,
    ...users,
  };

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }) => usersById[Number(where.id)] ?? null),
    },
  };

  mockCjsModule('../../config/database', prisma);
  mockCjsModule('../../config/passport', {
    initialize: () => passThroughMiddleware,
  });
  mockCjsModule('../../middlewares/rateLimiter.middleware', {
    globalLimiter: passThroughMiddleware,
    authLimiter: passThroughMiddleware,
  });
  mockCjsModule('morgan', () => passThroughMiddleware);

  mockCjsModule('../../services/auth.service', services.auth);
  mockCjsModule('../../services/nutrishop.service', services.nutrishop);
  mockCjsModule('../../services/children.service', services.children);
  mockCjsModule('../../services/healthLog.service', services.healthLog);
  mockCjsModule('../../services/specialist.service', services.specialist);
  mockCjsModule('../../services/consultation.service', services.consultation);
  mockCjsModule('../../services/article.service', services.article);
  mockCjsModule('../../services/admin.service', services.admin);

  const app = require('../../app');

  return {
    app,
    request: request(app),
    services,
    prisma,
    userToken: createAccessToken(testUsers.user),
    adminToken: createAccessToken(testUsers.admin),
    inactiveToken: createAccessToken(testUsers.inactive),
  };
};
