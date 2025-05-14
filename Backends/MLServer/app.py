import os
import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH")

if not FIREBASE_CREDENTIALS_PATH:
    raise ValueError("Missing required environment variable: FIREBASE_CREDENTIALS_PATH")




# Initialize Firebase
try:
    cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    raise ValueError(f"Failed to initialize Firebase: {str(e)}")

# Load the trained model
try:
    model = joblib.load('crop_predictor.pkl')
except FileNotFoundError:
    raise FileNotFoundError("Model file 'crop_predictor.pkl' not found")

# List of crop names
crop_names = ['apple', 'banana', 'blackgram', 'chickpea', 'coconut', 'coffee', 'cotton', 'grapes', 'jute',
              'kidneybeans', 'lentil', 'maize', 'mango', 'mothbeans', 'mungbean', 'muskmelon', 'orange',
              'papaya', 'pigeonpeas', 'pomegranate', 'rice', 'watermelon']

app = Flask(__name__)
CORS(app, origins=["https://khetifirebase-1.onrender.com"])

def apply_temperature_scaling(logits, temperature=1.5):
    """Apply temperature scaling to logits."""
    exp_logits = np.exp(logits / temperature)
    return exp_logits / np.sum(exp_logits)

def predict_top_3_crops(N, P, K, temperature, humidity, ph, rainfall, temperature_scale=1.5):
    """Predict top 3 suitable crops based on input parameters."""
    input_data = pd.DataFrame({
        'N': [float(N)],
        'P': [float(P)],
        'K': [float(K)],
        'temperature': [float(temperature)],
        'humidity': [float(humidity)],
        'ph': [float(ph)],
        'rainfall': [float(rainfall)]
    })
    
    try:
        logits = model.predict_proba(input_data)[0]
        scaled_probs = apply_temperature_scaling(logits, temperature=temperature_scale)
        top_3_indices = np.argsort(scaled_probs)[-3:][::-1]
        return [(crop_names[i], float(scaled_probs[i])) for i in top_3_indices]
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        raise ValueError(f"Failed to make prediction: {str(e)}")

def get_production_value(crop_name):
    """Get production value for a crop from Firebase."""
    try:
        crop_doc = db.collection('crops').document(crop_name).get()
        if crop_doc.exists:
            return crop_doc.to_dict().get('production', 0)
        return 0  # Return 0 for new crops
    except Exception as e:
        print(f"Error getting production for {crop_name}: {str(e)}")
        return 0

@app.route("/predict_crop", methods=["POST"])
def predict_crop():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
        if not all(field in data for field in required_fields):
            missing_fields = [field for field in required_fields if field not in data]
            return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

        if not (0 <= float(data['ph']) <= 14):
            return jsonify({"error": "pH must be between 0 and 14"}), 400
        if not (0 <= float(data['humidity']) <= 100):
            return jsonify({"error": "Humidity must be between 0 and 100"}), 400

        top_3_crops = predict_top_3_crops(
            data['N'], data['P'], data['K'],
            data['temperature'], data['humidity'],
            data['ph'], data['rainfall']
        )

        production_values = []
        for crop, prob in top_3_crops:
            production = get_production_value(crop)
            production_values.append({
                "crop": crop,
                "probability": float(prob),
                "production": float(production)
            })

        best_crop = min(production_values, key=lambda x: x["production"])

        return jsonify({
            "recommended_crop": best_crop["crop"],
            "probability": best_crop["probability"],
            "production_value": best_crop["production"]
        })

    except Exception as e:
        import traceback
        print("Error in predict_crop:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/add_production", methods=["POST"])
def add_crop_production():
    try:
        data = request.json
        if not all(key in data for key in ['crop_name', 'production_value']):
            return jsonify({"error": "Missing required fields"}), 400

        if data['crop_name'] not in crop_names:
            return jsonify({"error": "Invalid crop name"}), 400

        try:
            production_value = float(data['production_value'])
        except ValueError:
            return jsonify({"error": "Invalid production value"}), 400

        crop_ref = db.collection('crops').document(data['crop_name'])
        crop_doc = crop_ref.get()
        
        if crop_doc.exists:
            current_production = crop_doc.to_dict().get('production', 0)
            new_production = current_production + production_value
            crop_ref.update({"production": new_production})
        else:
            new_production = production_value
            crop_ref.set({"production": new_production})
        
        return jsonify({
            "message": f"Updated production for {data['crop_name']}",
            "new_value": new_production
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002)
