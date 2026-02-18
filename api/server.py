# OrbitBharat API Server
# ISRO-Level CME Detection API
# Developer: Nitesh Agarwal (2026)
#
# FastAPI backend for real-time CME predictions

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn
from datetime import datetime
import sys
import os

# Add ml_pipeline to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ml_pipeline'))

from predictor import CMEPredictor
from data_loader import DSCOVRDataLoader


# Initialize FastAPI app
app = FastAPI(
    title="OrbitBharat CME Detection API",
    description="Real-time Coronal Mass Ejection detection using AI ensemble model",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global predictor instance
predictor: Optional[CMEPredictor] = None
data_loader: Optional[DSCOVRDataLoader] = None


@app.on_event("startup")
async def startup():
    """Initialize models on startup"""
    global predictor, data_loader
    print("[START] Starting OrbitBharat API Server...")
    predictor = CMEPredictor(config='medium')
    data_loader = DSCOVRDataLoader()
    print("[OK] Models loaded successfully")


# Request/Response models
class PredictionResponse(BaseModel):
    status: str
    timestamp: str
    prediction: Optional[Dict] = None
    current_conditions: Optional[Dict] = None
    model_info: Optional[Dict] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    model_loaded: bool
    api_version: str


# Endpoints
@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": predictor is not None,
        "api_version": "2.0.0"
    }


@app.get("/api/predict", response_model=PredictionResponse)
async def predict():
    """
    Get real-time CME prediction
    
    Uses live DSCOVR satellite data to predict CME probability
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    result = predictor.predict_realtime()
    return result


@app.get("/api/conditions")
async def get_conditions():
    """Get current space weather conditions"""
    if data_loader is None:
        raise HTTPException(status_code=503, detail="Data loader not initialized")
    
    return data_loader.get_current_conditions()


@app.get("/api/forecast/{hours}")
async def get_forecast(hours: int = 24):
    """
    Get CME forecast for next N hours
    
    Args:
        hours: Forecast period (max 72)
    """
    if hours > 72:
        hours = 72
    
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    result = predictor.predict_realtime()
    
    if result['status'] == 'success':
        pred = result['prediction']
        return {
            'forecast_period_hours': hours,
            'cme_probability': pred['cme_probability'],
            'arrival_time_hours': min(pred['arrival_time_hours'], hours),
            'alert_level': pred['alert_level'],
            'confidence': pred['confidence'],
            'generated_at': datetime.now().isoformat()
        }
    
    raise HTTPException(status_code=500, detail=result.get('error', 'Prediction failed'))


@app.get("/api/accuracy")
async def get_accuracy():
    """Get model accuracy metrics"""
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return predictor.get_historical_accuracy()


@app.get("/api/feature-importance")
async def get_feature_importance():
    """Get feature importance for explainability"""
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return predictor.get_feature_importance()


@app.get("/api/model-info")
async def get_model_info():
    """Get model architecture information"""
    return {
        'name': 'CME Ensemble Model',
        'architecture': {
            'branch_1': 'Bidirectional LSTM with Multi-Head Attention (3 layers)',
            'branch_2': 'Transformer Encoder (4 layers, 8 heads)',
            'fusion': 'Concatenation + Dense layers',
            'output_heads': ['CME Probability', 'Arrival Time', 'Confidence']
        },
        'input': {
            'features': ['Solar Wind Speed', 'Proton Density', 'Temperature', 'IMF Bz', 'IMF Bt', 'Plasma Beta'],
            'window': '60 minutes',
            'resolution': '1 minute'
        },
        'data_source': 'DSCOVR Satellite at L1 (NOAA SWPC)',
        'developer': 'Nitesh Agarwal',
        'version': '2.0.0',
        'last_updated': datetime.now().strftime('%Y-%m-%d'),
        'validation_source': 'Historical CME Catalog 1850-2026 (SSN proxy + SOHO/LASCO + DONKI)',
    }


@app.get("/api/accuracy/refresh")
async def refresh_accuracy():
    """Force recompute of accuracy metrics (clears cache)."""
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    # Trigger background re-validation (non-blocking)
    predictor._accuracy_cache_time = None      # mark stale
    predictor._launch_bg_validation()          # kick off bg thread
    return predictor.get_historical_accuracy() # return current cache instantly


@app.get("/api/data/realtime")
async def get_realtime_data():
    """Get raw real-time solar wind data"""
    if data_loader is None:
        raise HTTPException(status_code=503, detail="Data loader not initialized")
    
    df = data_loader.get_realtime_data(days=1)
    
    if df.empty:
        raise HTTPException(status_code=503, detail="No data available")
    
    # Return last 100 data points
    df_recent = df.tail(100)
    
    return {
        'data_source': 'DSCOVR',
        'total_points': len(df_recent),
        'columns': list(df_recent.columns),
        'timestamps': [t.isoformat() for t in df_recent.index],
        'values': df_recent.to_dict('list')
    }


# Run server
if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("    ORBITBHARAT CME DETECTION API")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET /api/predict         - Real-time CME prediction")
    print("  GET /api/conditions      - Current space weather")
    print("  GET /api/forecast/{h}    - Forecast for next h hours")
    print("  GET /api/accuracy        - Model accuracy metrics")
    print("  GET /api/feature-importance - Explainability")
    print("  GET /api/model-info      - Architecture details")
    print("  GET /api/data/realtime   - Raw solar wind data")
    print("\nDocs: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
