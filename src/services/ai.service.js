const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PREDICT_SCRIPT_PATH = path.join(__dirname, '..', 'utils', 'predict.py');

/**
 * Service to handle AI model predictions by bridging to a Python script.
 */
const predictStunting = (data) => {
  return new Promise((resolve, reject) => {
    // Prepare standardized input for the Python script
    // model features: [age_months, sex, height, weight, mom_height]
    const inputPayload = JSON.stringify({
      umur_bulan: data.umurBulan,
      jenis_kelamin: data.jenisKelamin === 'LAKI_LAKI' ? 0 : 1, // Encode based on training (0=M, 1=F)
      tinggi_badan_anak_cm: data.tinggiBadan,
      berat_badan_anak_kg: data.beratBadan,
      tinggi_badan_ibu_cm: data.tinggiBadanIbu || null // fallback handled in python
    });

    const pyProcess = spawn(PYTHON_PATH, [PREDICT_SCRIPT_PATH, inputPayload]);

    let result = '';
    let error = '';

    // Timeout to prevent hanging if Python process gets stuck
    const timeout = setTimeout(() => {
      pyProcess.kill();
      reject('AI Prediction timed out after 10 seconds');
    }, 10000);

    pyProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(`Failed to start Python process: ${err.message}`);
    });

    pyProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pyProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(`Python process exited with code ${code}: ${error}`);
      }

      try {
        const parsedResult = JSON.parse(result);
        if (parsedResult.error) {
          return reject(parsedResult.error);
        }
        resolve(parsedResult);
      } catch (e) {
        reject(`Failed to parse AI output: ${result}`);
      }
    });
  });
};

module.exports = {
  predictStunting,
};
