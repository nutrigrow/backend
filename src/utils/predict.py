import sys
import os
import json
import joblib
import numpy as np
import warnings

# Suppress annoying warnings
warnings.filterwarnings('ignore')

# Constants
FALLBACK_MOM_HEIGHT = 151.5

def main():
    try:
        # 1. Get input data from argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            return
            
        data = json.loads(sys.argv[1])
        
        # 2. Extract and validate features
        # Features order: ['umur_bulan', 'jenis_kelamin', 'tinggi_badan_anak_cm', 'berat_badan_anak_kg', 'tinggi_badan_ibu_cm']
        age_months = data.get('umur_bulan')
        sex = data.get('jenis_kelamin') # 0=Male, 1=Female (standardized in our training)
        height = data.get('tinggi_badan_anak_cm')
        weight = data.get('berat_badan_anak_kg')
        mom_height = data.get('tinggi_badan_ibu_cm', FALLBACK_MOM_HEIGHT)
        
        if mom_height is None:
            mom_height = FALLBACK_MOM_HEIGHT

        # 3. Load model and scaler
        # Paths relative to this script or handled via absolute path
        model_dir = os.path.dirname(os.path.abspath(__file__))
        # Adjusted path to assets/models
        assets_dir = os.path.join(model_dir, '..', 'assets', 'models')
        
        model_path = os.path.join(assets_dir, 'nutrigrow_stunting_rf_model.pkl')
        scaler_path = os.path.join(assets_dir, 'nutrigrow_scaler.pkl')
        
        if not os.path.exists(model_path):
            print(json.dumps({"error": f"Model file not found at {model_path}"}))
            return

        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)

        # 4. Prepare input array
        X = np.array([[age_months, sex, height, weight, mom_height]])
        
        # 5. Preprocess (Scale)
        X_scaled = scaler.transform(X)
        
        # 6. Predict
        prediction = model.predict(X_scaled)[0]
        probabilities = model.predict_proba(X_scaled)[0]
        
        # Class probabilities: index 0 = Normal, index 1 = Stunting
        confidence = probabilities[1] if prediction == 1 else probabilities[0]
        
        # 7. Output result as JSON
        result = {
            "prediction": int(prediction), # 0 or 1
            "prediction_label": "Stunting" if prediction == 1 else "Normal",
            "confidence": float(confidence),
            "probabilities": {
                "normal": float(probabilities[0]),
                "stunting": float(probabilities[1])
            },
            "features_used": {
                "age_months": age_months,
                "sex": sex,
                "height_cm": height,
                "weight_kg": weight,
                "mom_height_cm": mom_height
            }
        }
        
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
