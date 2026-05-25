const { z } = require("zod");

const createOrUpdateLogSchema = {
  body: z
    .object({
      date: z
        .string({ required_error: "Tanggal harus diisi" })
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
          "Format tanggal tidak valid. Gunakan format YYYY-MM-DD",
        )
        .refine((val) => !isNaN(Date.parse(val)), {
          message: "Tanggal tidak valid",
        }),

      profile_type: z.enum(["teen", "pregnant", "breastfeeding"], {
        required_error: "Tipe profil harus diisi",
        message: "Tipe profil harus salah satu dari: teen, pregnant, breastfeeding",
      }),

      water_glasses: z
        .number({ required_error: "Jumlah gelas air harus diisi" })
        .int("Jumlah gelas air harus berupa bilangan bulat")
        .min(0, "Jumlah gelas air tidak boleh negatif"),

      sleep_hours: z
        .number({ required_error: "Durasi tidur harus diisi" })
        .min(0, "Durasi tidur tidak boleh negatif"),

      took_supplement: z.boolean({
        required_error: "Status konsumsi suplemen harus diisi",
        invalid_type_error: "Status konsumsi suplemen harus berupa boolean",
      }),

      mood: z
        .number({ required_error: "Mood harus diisi" })
        .int("Mood harus berupa bilangan bulat")
        .min(1, "Mood minimal bernilai 1")
        .max(5, "Mood maksimal bernilai 5"),

      // Conditional fields — optional at schema level, enforced via superRefine
      is_menstruating: z
        .boolean({ invalid_type_error: "Status haid harus berupa boolean" })
        .optional(),

      weight_kg: z
        .number({ invalid_type_error: "Berat badan harus berupa angka" })
        .positive("Berat badan harus bernilai positif")
        .optional(),

      breastfeeding_count: z
        .number({ invalid_type_error: "Frekuensi menyusui harus berupa angka" })
        .int("Frekuensi menyusui harus berupa bilangan bulat")
        .min(0, "Frekuensi menyusui tidak boleh negatif")
        .optional(),

      is_edit: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.profile_type === "teen" && data.is_menstruating === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["is_menstruating"],
          message:
            "Status haid (is_menstruating) harus diisi untuk profil remaja",
        });
      }

      if (data.profile_type === "pregnant" && data.weight_kg === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weight_kg"],
          message:
            "Berat badan (weight_kg) harus diisi untuk profil ibu hamil",
        });
      }

      if (
        data.profile_type === "breastfeeding" &&
        data.breastfeeding_count === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["breastfeeding_count"],
          message:
            "Frekuensi menyusui (breastfeeding_count) harus diisi untuk profil ibu menyusui",
        });
      }
    }),
};

module.exports = {
  createOrUpdateLogSchema,
};
