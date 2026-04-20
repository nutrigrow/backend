/**
 * Scaler utility for NutriGrow AI model.
 * Performs StandardScaler normalization: (x - mean) / scale
 * 
 * Input features order:
 * 0: umur_bulan (age in months)
 * 1: jenis_kelamin (0=Male, 1=Female)
 * 2: tinggi_badan_anak_cm (child height)
 * 3: berat_badan_anak_kg (child weight)
 * 4: tinggi_badan_ibu_cm (mom height)
 */

const SCALER_PARAMS = {
  mean: [30.52029858003768, 0.46662156066756877, 83.98018050350095, 11.395293488671703, 151.6750282187976],
  scale: [17.17372082180589, 0.49888463575032177, 13.95778894736525, 3.822355537523678, 4.000526227731126]
};

/**
 * Normalizes an array of features using the learned StandardScaler params.
 * @param {number[]} features 
 * @returns {Float32Array}
 */
const transform = (features) => {
  if (features.length !== SCALER_PARAMS.mean.length) {
    throw new Error(`Expected ${SCALER_PARAMS.mean.length} features, but got ${features.length}`);
  }

  const normalized = features.map((val, i) => {
    return (val - SCALER_PARAMS.mean[i]) / SCALER_PARAMS.scale[i];
  });

  return new Float32Array(normalized);
};

module.exports = {
  transform
};
