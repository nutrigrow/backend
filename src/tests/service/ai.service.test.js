import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let aiService;

const { ort, scaler, session } = vi.hoisted(() => {
  const session = {
    run: vi.fn(),
  };

  function Tensor(type, data, dims) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }

  return {
    session,
    ort: {
      InferenceSession: {
        create: vi.fn(),
      },
      Tensor: vi.fn(Tensor),
    },
    scaler: {
      transform: vi.fn(),
    },
  };
});

const loadService = () => {
  const ortPath = require.resolve('onnxruntime-node');
  const scalerPath = require.resolve('../../utils/scaler-utils');
  const servicePath = require.resolve('../../services/ai.service');

  delete require.cache[servicePath];
  require.cache[ortPath] = {
    id: ortPath,
    filename: ortPath,
    loaded: true,
    exports: ort,
  };
  require.cache[scalerPath] = {
    id: scalerPath,
    filename: scalerPath,
    loaded: true,
    exports: scaler,
  };

  aiService = require('../../services/ai.service');
};

beforeEach(() => {
  vi.resetAllMocks();
  ort.InferenceSession.create.mockResolvedValue(session);
  scaler.transform.mockReturnValue(new Float32Array([1, 2, 3, 4, 5]));
  session.run.mockResolvedValue({
    label: { data: [1] },
    probabilities: { data: new Float32Array([0.1, 0.9]) },
  });
  loadService();
});

describe('aiService.predictStunting', () => {
  it('returns standardized prediction and uses mother height fallback when missing', async () => {
    const result = await aiService.predictStunting({
      umurBulan: 24,
      jenisKelamin: 'PEREMPUAN',
      tinggiBadan: 80,
      beratBadan: 10,
    });

    expect(result).toMatchObject({
      prediction: 1,
      risk_level: 'HIGH_ALERT',
      risk_label: 'Indikator Melambat Signifikan',
      confidence: expect.closeTo(0.9),
      momHeightFallbackUsed: true,
      probabilities: {
        normal: expect.closeTo(0.1),
        stunting: expect.closeTo(0.9),
      },
      features_used: {
        age_months: 24,
        sex: 1,
        height_cm: 80,
        weight_kg: 10,
        mom_height_cm: 151.5,
      },
    });
    expect(scaler.transform).toHaveBeenCalledWith([24, 1, 80, 10, 151.5]);
    expect(session.run).toHaveBeenCalledWith({
      float_input: expect.objectContaining({
        type: 'float32',
        dims: [1, 5],
      }),
    });
  });

  it('returns NORMAL risk for low stunting probability', async () => {
    session.run.mockResolvedValue({
      label: { data: [0] },
      probabilities: { data: new Float32Array([0.85, 0.15]) },
    });

    const result = await aiService.predictStunting({
      umurBulan: 18,
      jenisKelamin: 'LAKI_LAKI',
      tinggiBadan: 78,
      beratBadan: 9,
      tinggiBadanIbu: 158,
    });

    expect(result.risk_level).toBe('NORMAL');
    expect(result.risk_label).toBe('Pola Pertumbuhan Optimal');
  });

  it('returns WARNING risk for moderate stunting probability', async () => {
    session.run.mockResolvedValue({
      label: { data: [1] },
      probabilities: { data: new Float32Array([0.48, 0.52]) },
    });

    const result = await aiService.predictStunting({
      umurBulan: 18,
      jenisKelamin: 'LAKI_LAKI',
      tinggiBadan: 78,
      beratBadan: 9,
      tinggiBadanIbu: 158,
    });

    expect(result.risk_level).toBe('WARNING');
    expect(result.risk_label).toBe('Keyword Warning Terdeteksi');
  });

  it('throws an error when model execution fails', async () => {
    session.run.mockRejectedValue(new Error('model failed'));

    await expect(
      aiService.predictStunting({
        umurBulan: 24,
        jenisKelamin: 'LAKI_LAKI',
        tinggiBadan: 80,
        beratBadan: 10,
        tinggiBadanIbu: 158,
      }),
    ).rejects.toThrow('AI Prediction failed: model failed');
  });
});

