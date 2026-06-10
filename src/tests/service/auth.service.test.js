import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
let authService;
const testSigningKey = randomBytes(32).toString('hex');

const { prisma, bcrypt, emailService, aiService } = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    balita: {
      findMany: vi.fn(),
    },
    rekamPertumbuhan: {
      update: vi.fn(),
    },
  },
  bcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  emailService: {
    sendPasswordResetEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
  aiService: {
    predictStunting: vi.fn(),
  },
}));

const user = {
  id: 7,
  nama: 'Bunda',
  email: 'bunda@example.com',
  role: 'USER',
  avatarUrl: null,
  passwordHash: 'hashed-old',
  isActive: true,
  deletedAt: null,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const loadService = () => {
  const databasePath = require.resolve('../../config/database');
  const bcryptPath = require.resolve('bcryptjs');
  const emailPath = require.resolve('../../services/email.service');
  const aiPath = require.resolve('../../services/ai.service');
  const servicePath = require.resolve('../../services/auth.service');

  delete require.cache[servicePath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: prisma,
  };
  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcrypt,
  };
  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: emailService,
  };
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: aiService,
  };

  authService = require('../../services/auth.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  process.env.JWT_SECRET = testSigningKey;
  process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
  bcrypt.hash.mockResolvedValue('hashed-new');
  bcrypt.compare.mockResolvedValue(true);
  prisma.refreshToken.create.mockResolvedValue({ id: 1 });
  loadService();
});

describe('authService.register', () => {
  it('rejects duplicate email before hashing or sending verification email', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      authService.register({
        nama: 'Bunda',
        email: 'bunda@example.com',
        password: 'Password1',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email sudah terdaftar',
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends verification email for a new registration without creating user immediately', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    emailService.sendVerificationEmail.mockResolvedValue(undefined);

    await expect(
      authService.register({
        nama: 'Bunda',
        email: 'bunda@example.com',
        password: 'Password1',
      }),
    ).resolves.toBeNull();

    expect(bcrypt.hash).toHaveBeenCalledWith('Password1', expect.any(Number));
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      'bunda@example.com',
      expect.any(String),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('authService.login', () => {
  it('rejects invalid password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'bunda@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email atau password salah',
    });

    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('returns sanitized user data and stores hashed refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await authService.login(
      { email: 'bunda@example.com', password: 'Password1' },
      { userAgent: 'vitest', ipAddress: '127.0.0.1' },
    );

    expect(result.user).toEqual({
      id: 7,
      nama: 'Bunda',
      email: 'bunda@example.com',
      role: 'USER',
      avatarUrl: null,
    });
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        tokenHash: expect.any(String),
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      }),
    });
  });
});

describe('authService.refreshAccessToken', () => {
  it('rotates a valid refresh token', async () => {
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, process.env.JWT_SECRET);

    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 11,
      user,
    });

    const tokens = await authService.refreshAccessToken(refreshToken, {
      userAgent: 'vitest',
    });

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { isRevoked: true },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});

describe('authService.changePassword', () => {
  it('rejects wrong current password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.changePassword(7, 'wrong', 'NewPassword1')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Password lama salah',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('authService.updateMe', () => {
  it('updates mother height and recalculates stunting predictions', async () => {
    const updatedUser = {
      id: 7,
      nama: 'Bunda',
      email: 'bunda@example.com',
      role: 'USER',
      avatarUrl: null,
      tinggiBadanIbu: 158,
      updatedAt: new Date('2026-05-25T00:00:00.000Z'),
    };

    prisma.user.update.mockResolvedValue(updatedUser);
    prisma.balita.findMany.mockResolvedValue([
      {
        id: 1,
        jenisKelamin: 'LAKI_LAKI',
        tanggalLahir: new Date('2025-01-01T00:00:00.000Z'),
        rekamPertumbuhan: [
          {
            id: 101,
            tanggalCatat: new Date('2026-01-01T00:00:00.000Z'),
            tinggiBadan: 75,
            beratBadan: 9.5,
          },
        ],
      },
    ]);
    aiService.predictStunting.mockResolvedValue({
      prediction_label: 'Normal',
      confidence: 0.91,
    });
    prisma.rekamPertumbuhan.update.mockResolvedValue({ id: 101 });

    await expect(authService.updateMe(7, { tinggiBadanIbu: 158 })).resolves.toEqual(updatedUser);

    expect(aiService.predictStunting).toHaveBeenCalledWith(
      expect.objectContaining({
        jenisKelamin: 'LAKI_LAKI',
        tinggiBadan: 75,
        beratBadan: 9.5,
        tinggiBadanIbu: 158,
      }),
    );
    expect(prisma.rekamPertumbuhan.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        risikoStuntingMl: 'Normal',
        mlConfidence: 91,
      },
    });
  });
});
