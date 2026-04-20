import sys
import os
import json
import joblib
import numpy as np
import warnings

warnings.filterwarnings('ignore')

FALLBACK_MOM_HEIGHT = 151.5

def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            return
            
        data = json.loads(sys.argv[1])
        
        age_months = data.get('umur_bulan')
        sex = data.get('jenis_kelamin') # 0=Male, 1=Female
        height = data.get('tinggi_badan_anak_cm')
        weight = data.get('berat_badan_anak_kg')
        mom_height = data.get('tinggi_badan_ibu_cm', FALLBACK_MOM_HEIGHT)
        
        if mom_height is None:
            mom_height = FALLBACK_MOM_HEIGHT

        model_dir = os.path.dirname(os.path.abspath(__file__))
        assets_dir = os.path.join(model_dir, '..', 'assets', 'models')
        
        model_path = os.path.join(assets_dir, 'nutrigrow_stunting_rf_model.pkl')
        scaler_path = os.path.join(assets_dir, 'nutrigrow_scaler.pkl')
        
        if not os.path.exists(model_path):
            print(json.dumps({"error": f"Model file not found at {model_path}"}))
            return

        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)

        X = np.array([[age_months, sex, height, weight, mom_height]])
        
        X_scaled = scaler.transform(X)
        
        prediction = model.predict(X_scaled)[0]
        probabilities = model.predict_proba(X_scaled)[0]
        
        confidence = probabilities[1] if prediction == 1 else probabilities[0]
        
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
