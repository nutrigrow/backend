import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Service hanya dipakai untuk fungsi murni (generateInsights, analyzeHealthLogs) dan deleteLog. 
vi.mock('../../config/database', () => ({
  default: { logKesehatan: {}, konsultasi: {} },
  logKesehatan: {},
  konsultasi: {},
}));

import healthLogService from '../../services/healthLog.service.js';

const { generateInsights, analyzeHealthLogs, deleteLog } = healthLogService;
const prisma = createRequire(import.meta.url)('../../config/database');

// Tanggal acuan tetap agar hasil pengujian deterministik
const TODAY = new Date(Date.UTC(2026, 9, 8)); // 2026-10-08

const dateDaysAgo = (daysAgo) => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const makeLog = (daysAgo, overrides = {}) => ({
  id: daysAgo + 1,
  user_id: 7,
  date: dateDaysAgo(daysAgo),
  day: 'Monday',
  profile_type: 'teen',
  water_glasses: 8,
  sleep_hours: 8,
  took_supplement: true,
  mood: 4,
  is_menstruating: false,
  ...overrides,
});

// Buat log berturut-turut mulai hari ini (daysAgo = 0, 1, 2, ...)
const makeLogs = (count, overrides = {}) =>
  Array.from({ length: count }, (_, i) =>
    makeLog(i, typeof overrides === 'function' ? overrides(i) : overrides),
  );

const categories = (insights) => insights.map((insight) => insight.category);
const byId = (insights, id) => insights.find((insight) => insight.id === id);

describe('generateInsights — data belum cukup / tidak valid', () => {
  it('returns "Cek Data" when there are no logs', () => {
    const insights = generateInsights([], TODAY);
    expect(categories(insights)).toEqual(['Cek Data']);
    expect(insights[0].id).toBe('insufficient-data');
    expect(insights[0].detail.pattern_summary).toBe('Data belum cukup untuk melihat pola.');
  });

  it('returns "Cek Data" when fewer than 3 logs exist in the last 7 days', () => {
    const insights = generateInsights(makeLogs(2), TODAY);
    expect(categories(insights)).toEqual(['Cek Data']);
    expect(insights[0].id).toBe('insufficient-data');
    expect(insights[0].based_on).toEqual(['Log tercatat: 2/7 hari']);
  });

  it('returns "Pengingat" when the last log is 7 days old or more', () => {
    const insights = generateInsights([makeLog(9), makeLog(10), makeLog(11)], TODAY);
    expect(categories(insights)).toEqual(['Pengingat']);
    expect(insights[0].id).toBe('logging-stopped');
  });

  it('does not interpret data when sleep hours are out of range', () => {
    const insights = generateInsights(makeLogs(5, (i) => (i === 1 ? { sleep_hours: 30 } : {})), TODAY);
    expect(categories(insights)).toEqual(['Cek Data']);
    expect(insights[0].id).toBe('invalid-data');
    expect(insights[0].based_on).toContain('Durasi tidur di luar rentang wajar');
    expect(insights[0].detail.history.map((row) => row.date)).toEqual([dateDaysAgo(1)]);
  });

  it('does not interpret data when water glasses are out of range', () => {
    const insights = generateInsights(makeLogs(5, (i) => (i === 0 ? { water_glasses: 25 } : {})), TODAY);
    expect(insights[0].based_on).toContain('Asupan cairan di luar rentang wajar');
  });

  it('does not interpret data when mood is outside 1-5', () => {
    const insights = generateInsights(makeLogs(5, (i) => (i === 0 ? { mood: 9 } : {})), TODAY);
    expect(insights[0].id).toBe('invalid-data');
  });

  it('flags weight change above 15% within 14 days as "Cek Data"', () => {
    const logs = makeLogs(5, (i) => ({ profile_type: 'pregnant', weight_kg: i === 0 ? 80 : i === 4 ? 60 : 70 }));
    const insights = generateInsights(logs, TODAY);
    expect(categories(insights)).toEqual(['Cek Data']);
    expect(insights[0].based_on).toContain('Perubahan berat badan lebih dari 15% dalam 14 hari');
  });

  it('only uses logs from the most recent profile type', () => {
    const logs = [
      ...makeLogs(2, { profile_type: 'pregnant', weight_kg: 60 }),
      makeLog(3), makeLog(4), makeLog(5),
    ];
    expect(generateInsights(logs, TODAY)[0].id).toBe('insufficient-data');
  });
});

describe('generateInsights — pola dari riwayat', () => {
  it('combines low sleep and low water into one insight using actual averages', () => {
    const logs = [
      makeLog(0, { sleep_hours: 3, water_glasses: 5 }),
      makeLog(2, { sleep_hours: 3, water_glasses: 4 }),
      makeLog(3, { sleep_hours: 2, water_glasses: 2 }),
    ];
    const insight = byId(generateInsights(logs, TODAY), 'low-sleep-and-water');
    expect(insight.category).toBe('Perlu Diperhatikan');
    expect(insight.title).toBe('Tidur dan asupan cairan tercatat rendah');
    expect(insight.based_on).toEqual(['Rata-rata tidur: 2,7 jam', 'Rata-rata cairan: 3,7 gelas']);
    expect(insight.action.label).toBe('Konsultasi via Tele-Nutrition');
  });

  it('raises single-field insights for low sleep and low water', () => {
    const sleep = byId(generateInsights(makeLogs(7, { sleep_hours: 5 }), TODAY), 'sleep-low');
    const water = byId(generateInsights(makeLogs(7, { water_glasses: 4 }), TODAY), 'hydration-low');
    expect(sleep.title).toBe('Durasi tidur tercatat rendah');
    expect(water.title).toBe('Asupan cairan tercatat rendah');
  });

  it('combines mood, sleep, and water as recurring fatigue; escalates at 5 days', () => {
    const mid = byId(generateInsights(makeLogs(7, (i) => ({ mood: i < 3 ? 2 : 4, sleep_hours: 5 })), TODAY), 'recurring-fatigue');
    const high = byId(generateInsights(makeLogs(7, (i) => ({ mood: i < 5 ? 2 : 4, sleep_hours: 5 })), TODAY), 'recurring-fatigue');
    expect(mid.category).toBe('Perlu Diperhatikan');
    expect(high.category).toBe('Segera Konsultasi');
    expect(high.status).toBe('danger');
  });

  it('does not escalate to "Segera Konsultasi" from mood alone', () => {
    const insight = byId(generateInsights(makeLogs(7, (i) => ({ mood: i < 6 ? 2 : 4 })), TODAY), 'mood-low');
    expect(insight.category).toBe('Perlu Diperhatikan');
  });

  it('reminds when supplement is recorded on fewer than 4 of 7 days', () => {
    const insight = byId(generateInsights(makeLogs(7, (i) => ({ took_supplement: i < 3 })), TODAY), 'supplement-irregular');
    expect(insight.category).toBe('Pengingat');
    expect(insight.based_on).toEqual(['Suplemen tercatat: 3/7 hari']);
    expect(insight.message).toContain('Tablet Tambah Darah (TTD)');
    expect(insight.detail.data_used).toContain('Tercatat dikonsumsi: 3 hari');
    expect(insight.detail.data_used).toContain('Tidak tercatat: 4 hari (termasuk hari tanpa catatan)');
  });

  it('counts days without logs as not recorded for supplements', () => {
    const insight = byId(generateInsights(makeLogs(3), TODAY), 'supplement-irregular');
    expect(insight.based_on).toEqual(['Suplemen tercatat: 3/7 hari']);
  });

  it('uses the generic supplement label for non-teen profiles', () => {
    const logs = makeLogs(7, (i) => ({ profile_type: 'breastfeeding', took_supplement: i < 2, breastfeeding_count: 8 }));
    expect(byId(generateInsights(logs, TODAY), 'supplement-irregular').message.startsWith('Suplemen')).toBe(true);
  });

  it('links menstruation days with TTD consumption for teens', () => {
    const logs = makeLogs(7, (i) => ({ is_menstruating: i < 3, took_supplement: i !== 1 }));
    const insight = byId(generateInsights(logs, TODAY), 'cycle-supplement');
    expect(insight.based_on).toEqual(['Haid tercatat: 3 hari', 'TTD saat haid: 2/3 hari']);
  });

  it('flags decreasing weight for pregnant profile and positive otherwise', () => {
    const down = makeLogs(5, (i) => ({ profile_type: 'pregnant', weight_kg: 60 + i }));
    const up = makeLogs(5, (i) => ({ profile_type: 'pregnant', weight_kg: 60 - i * 0.2 }));
    expect(analyzeHealthLogs(down, TODAY).fieldInsights.weight.id).toBe('weight-attention');
    expect(analyzeHealthLogs(up, TODAY).fieldInsights.weight.id).toBe('weight-progress');
  });

  it('flags low breastfeeding sessions for breastfeeding profile', () => {
    const logs = makeLogs(5, { profile_type: 'breastfeeding', breastfeeding_count: 4 });
    const insight = analyzeHealthLogs(logs, TODAY).fieldInsights.breastfeeding;
    expect(insight.id).toBe('breastfeeding-low');
    expect(insight.based_on).toEqual(['Rata-rata sesi: 4/hari']);
  });

  it('returns positive progress when logs are recorded on 5 days or more', () => {
    const insights = generateInsights(makeLogs(6), TODAY);
    expect(categories(insights)).toEqual(['Perkembangan Baik']);
    expect(insights[0].status).toBe('safe');
    expect(insights[0].based_on[0]).toBe('Log tercatat: 6/7 hari');
  });

  it('orders by priority and never exceeds 4 insights', () => {
    const logs = makeLogs(7, (i) => ({ mood: i < 5 ? 2 : 4, sleep_hours: 5, took_supplement: i < 2, is_menstruating: i < 3 }));
    const insights = generateInsights(logs, TODAY);
    expect(insights.length).toBeLessThanOrEqual(4);
    expect(insights[0].category).toBe('Segera Konsultasi');
    const order = ['Segera Konsultasi', 'Perlu Diperhatikan', 'Cek Data', 'Pengingat', 'Perkembangan Baik'];
    const ranks = insights.map((insight) => order.indexOf(insight.category));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('uses history of the previous 7 days when available', () => {
    const logs = [
      ...makeLogs(7, { sleep_hours: 7 }),
      ...Array.from({ length: 7 }, (_, i) => makeLog(7 + i, { sleep_hours: 5 })),
    ];
    const { fieldInsights } = analyzeHealthLogs(logs, TODAY);
    expect(fieldInsights.sleep.detail.data_used.join(' ')).toContain('naik 2 jam dibanding 7 hari sebelumnya');
  });

  it('accepts unsorted logs', () => {
    expect(categories(generateInsights(makeLogs(6).reverse(), TODAY))).toEqual(['Perkembangan Baik']);
  });
});

describe('generateInsights — struktur Card dan Detail', () => {
  const rich = makeLogs(7, (i) => ({ mood: i < 5 ? 2 : 4, sleep_hours: 5, took_supplement: i < 2 }));

  it('provides all card fields and all detail fields on every insight', () => {
    const scenarios = [[], makeLogs(2), makeLogs(6), rich, makeLogs(5, (i) => (i === 0 ? { sleep_hours: 40 } : {}))];
    scenarios.forEach((logs) => {
      generateInsights(logs, TODAY).forEach((insight) => {
        expect(insight.category).toBeTruthy();
        expect(insight.title).toBeTruthy();
        expect(insight.message).toBeTruthy();
        expect(insight.action.label).toBeTruthy();
        expect(insight.disclaimer).toContain('bukan diagnosis medis');
        const d = insight.detail;
        expect(d.title).toBe(insight.title);
        expect(d.pattern_summary).toBeTruthy();
        expect(d.data_used).toBeInstanceOf(Array);
        expect(d.history).toBeInstanceOf(Array);
        expect(d.reason).toBeTruthy();
        expect(d.action_text).toBeTruthy();
        expect(d.disclaimer).toBe(insight.disclaimer);
      });
    });
  });

  it('keeps Card numbers consistent with Detail data', () => {
    const logs = [
      makeLog(0, { sleep_hours: 3, water_glasses: 5 }),
      makeLog(2, { sleep_hours: 3, water_glasses: 4 }),
      makeLog(3, { sleep_hours: 2, water_glasses: 2 }),
    ];
    const insight = byId(generateInsights(logs, TODAY), 'low-sleep-and-water');
    insight.based_on.forEach((chip) => expect(insight.detail.data_used).toContain(chip));
    expect(insight.detail.history).toHaveLength(7);
    expect(insight.detail.history.filter((row) => row.state === 'missing')).toHaveLength(4);
    expect(insight.detail.reason).toContain('2,7 jam');
  });

  it('exposes one insight per field for the stat card Detail', () => {
    const { fieldInsights } = analyzeHealthLogs(makeLogs(6), TODAY);
    expect(Object.keys(fieldInsights).sort()).toEqual(['hydration', 'mood', 'sleep', 'supplement']);
  });

  it('returns no field insights when data is insufficient', () => {
    expect(analyzeHealthLogs(makeLogs(2), TODAY).fieldInsights).toEqual({});
  });

  it('uses only real actions available in the app', () => {
    const allowed = ['consult', 'log', 'history', 'article'];
    generateInsights(rich, TODAY).forEach((insight) => expect(allowed).toContain(insight.action.type));
  });

  it('never uses diagnostic wording or disease names in insight text', () => {
    const scenarios = [
      [], makeLogs(2), makeLogs(6), rich, makeLogs(7, { water_glasses: 3 }),
      makeLogs(5, (i) => (i === 0 ? { sleep_hours: 40 } : {})), [makeLog(12), makeLog(13), makeLog(14)],
      makeLogs(5, (i) => ({ profile_type: 'pregnant', weight_kg: 60 + i })),
      makeLogs(5, { profile_type: 'breastfeeding', breastfeeding_count: 3 }),
    ];
    const forbidden = /anda mengalami|anemia|preeklamsia|dehidrasi|stunting|depresi|menderita|terkena/i;
    scenarios.forEach((logs) => {
      const { insights, fieldInsights } = analyzeHealthLogs(logs, TODAY);
      [...insights, ...Object.values(fieldInsights)].forEach((insight) => {
        const text = JSON.stringify([insight.title, insight.message, insight.detail]);
        expect(text).not.toMatch(forbidden);
      });
    });
  });

  it('does not mutate the input logs', () => {
    const logs = makeLogs(6).reverse();
    const snapshot = JSON.parse(JSON.stringify(logs));
    generateInsights(logs, TODAY);
    expect(logs).toEqual(snapshot);
  });
});

describe('deleteLog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('deletes only a log owned by the user', async () => {
    const deleteMany = vi.spyOn(prisma.logKesehatan, 'deleteMany').mockResolvedValue({ count: 1 });
    await expect(deleteLog(7, 12)).resolves.toEqual({ id: 12 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 12, userId: 7 } });
  });

  it('throws when the log does not exist or belongs to another user', async () => {
    vi.spyOn(prisma.logKesehatan, 'deleteMany').mockResolvedValue({ count: 0 });
    await expect(deleteLog(7, 99)).rejects.toThrow('Catatan kesehatan tidak ditemukan');
  });
});