const ort = require('onnxruntime-node');
const path = require('path');
const scaler = require('../utils/scaler-utils');

const MODEL_PATH = path.join(__dirname, '..', 'assets', 'models', 'nutrigrow_stunting.onnx');
const FALLBACK_MOM_HEIGHT = 151.5;

let session = null;

/**
 * Loads the ONNX session once (lazy singleton).
 */
const getSession = async () => {
  if (!session) {
    try {
      session = await ort.InferenceSession.create(MODEL_PATH);
    } catch (err) {
      console.error('Failed to load ONNX model:', err);
      throw new Error('AI Model initialization failed');
    }
  }
  return session;
};

/**
 * Service to handle AI model predictions using ONNX Runtime.
 * No longer requires Python environment.
 * 
 * @param {Object} data - Input growth data
 * @returns {Promise<Object>} - Standardized prediction result
 */
const predictStunting = async (data) => {
  try {
    const sess = await getSession();

    // Prepare input: [umur_bulan, jenis_kelamin, tinggi_badan_anak_cm, berat_badan_anak_kg, tinggi_badan_ibu_cm]
    const features = [
      Number(data.umurBulan) || 0,
      data.jenisKelamin === 'LAKI_LAKI' ? 0 : 1,
      Number(data.tinggiBadan) || 0,
      Number(data.beratBadan) || 0,
      Number(data.tinggiBadanIbu) || FALLBACK_MOM_HEIGHT
    ];

    // Normalize
    const scaledFeatures = scaler.transform(features);

    // Run inference
    // initial_type was named 'float_input' in the conversion script
    const feeds = { float_input: new ort.Tensor('float32', scaledFeatures, [1, 5]) };
    const results = await sess.run(feeds);

    // Results in skl2onnx usually have:
    // output_label: Int64 tensor [1]
    // output_probability: sequence of map/array
    
    const prediction = Number(results.label.data[0]);
    const probabilities = results.probabilities.data; 
    
    // With zipmap: False, probabilities is a flat Float32Array [prob_class_0, prob_class_1]
    const probNormal = Number(probabilities[0]);
    const probStunting = Number(probabilities[1]);

    const confidence = prediction === 1 ? probStunting : probNormal;
    const isMomHeightFallback = !data.tinggiBadanIbu;

    let riskLevel = "NORMAL";
    let riskLabel = "Pola Pertumbuhan Optimal";

    if (probStunting >= 0.7) {
      riskLevel = "HIGH_ALERT";
      riskLabel = "Indikator Melambat Signifikan";
    } else if (probStunting >= 0.4) {
      riskLevel = "WARNING";
      riskLabel = "Keyword Warning Terdeteksi";
    }

    return {
      prediction: prediction, // 0 for Normal, 1 for Stunting
      risk_level: riskLevel, // NORMAL, WARNING, HIGH_ALERT
      risk_label: riskLabel, // Pola Pertumbuhan Optimal / Keyword Warning Terdeteksi / Indikator Melambat Signifikan
      confidence: Number(confidence),
      momHeightFallbackUsed: isMomHeightFallback,
      probabilities: {
        normal: Number(probNormal),
        stunting: Number(probStunting)
      },
      features_used: {
        age_months: features[0],
        sex: features[1],
        height_cm: features[2],
        weight_kg: features[3],
        mom_height_cm: features[4]
      }
    };
  } catch (err) {
    console.error('AI Prediction execution error:', err);
    throw new Error(`AI Prediction failed: ${err.message}`);
  }
};

module.exports = {
  predictStunting,
};
