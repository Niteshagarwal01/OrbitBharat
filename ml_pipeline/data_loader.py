# Real-Time DSCOVR/ACE Data Loader
# ISRO-Level Implementation
# Developer: Nitesh Agarwal (2026)
#
# Fetches real solar wind data from NOAA's DSCOVR satellite at L1

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import requests
import json

# Try importing scientific libraries
try:
    from sunpy.timeseries import TimeSeries
    from sunpy.time import TimeRange
    SUNPY_AVAILABLE = True
except ImportError:
    SUNPY_AVAILABLE = False
    print("[WARN] SunPy not installed. Using basic data handling.")

try:
    from astropy import units as u
    ASTROPY_AVAILABLE = True
except ImportError:
    ASTROPY_AVAILABLE = False


class DSCOVRDataLoader:
    """
    Real-time solar wind data from DSCOVR satellite at L1 Lagrange point.
    
    Data sources:
    - NOAA SWPC: Real-time plasma (speed, density, temperature)
    - NOAA SWPC: Real-time magnetic field (Bx, By, Bz, Bt)
    
    Features for CME detection:
    1. Bulk Speed (km/s) - Sudden increase indicates CME shock
    2. Proton Density (p/cm³) - Density pile-up ahead of CME
    3. Temperature (K) - Often drops inside CME
    4. Bz (nT) - Southward Bz causes geomagnetic storms
    5. Bt (nT) - Total magnetic field magnitude
    6. Plasma Beta - Ratio of plasma to magnetic pressure
    """
    
    NOAA_BASE = "https://services.swpc.noaa.gov"
    
    # Endpoints for different data
    PLASMA_1MIN = "/products/solar-wind/plasma-1-day.json"
    PLASMA_7DAY = "/products/solar-wind/plasma-7-day.json"
    MAG_1MIN = "/products/solar-wind/mag-1-day.json"
    MAG_7DAY = "/products/solar-wind/mag-7-day.json"
    
    def __init__(self, cache_enabled: bool = True):
        self.cache_enabled = cache_enabled
        self._cache: Dict[str, pd.DataFrame] = {}
        self._cache_timestamp: Dict[str, datetime] = {}
        self.cache_ttl = timedelta(minutes=5)  # Cache for 5 minutes
    
    def _fetch_json(self, endpoint: str) -> Optional[List]:
        """Fetch JSON data from NOAA"""
        try:
            url = f"{self.NOAA_BASE}{endpoint}"
            response = requests.get(url, timeout=30)
            if response.ok:
                return response.json()
        except Exception as e:
            print(f"Error fetching {endpoint}: {e}")
        return None
    
    def _parse_plasma_data(self, data: List) -> pd.DataFrame:
        """Parse NOAA plasma JSON to DataFrame"""
        if not data or len(data) < 2:
            return pd.DataFrame()
        
        # First row is header
        headers = data[0]
        records = data[1:]
        
        df = pd.DataFrame(records, columns=headers)
        
        # Convert types
        df['time_tag'] = pd.to_datetime(df['time_tag'])
        for col in ['density', 'speed', 'temperature']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.set_index('time_tag')
        df = df.sort_index()
        
        return df
    
    def _parse_mag_data(self, data: List) -> pd.DataFrame:
        """Parse NOAA magnetic field JSON to DataFrame"""
        if not data or len(data) < 2:
            return pd.DataFrame()
        
        headers = data[0]
        records = data[1:]
        
        df = pd.DataFrame(records, columns=headers)
        
        df['time_tag'] = pd.to_datetime(df['time_tag'])
        for col in ['bx_gsm', 'by_gsm', 'bz_gsm', 'bt']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.set_index('time_tag')
        df = df.sort_index()
        
        return df
    
    def get_realtime_data(self, days: int = 1) -> pd.DataFrame:
        """
        Get combined plasma + magnetic field data
        
        Returns DataFrame with columns:
        - speed: Solar wind speed (km/s)
        - density: Proton density (p/cm³)
        - temperature: Temperature (K)
        - bz: IMF Bz component (nT)
        - bt: Total magnetic field (nT)
        - beta: Plasma beta (computed)
        """
        cache_key = f"combined_{days}d"
        
        # Check cache
        if self.cache_enabled and cache_key in self._cache:
            if datetime.now() - self._cache_timestamp[cache_key] < self.cache_ttl:
                return self._cache[cache_key]
        
        # Fetch data
        if days <= 1:
            plasma_raw = self._fetch_json(self.PLASMA_1MIN)
            mag_raw = self._fetch_json(self.MAG_1MIN)
        else:
            plasma_raw = self._fetch_json(self.PLASMA_7DAY)
            mag_raw = self._fetch_json(self.MAG_7DAY)
        
        plasma_df = self._parse_plasma_data(plasma_raw) if plasma_raw else pd.DataFrame()
        mag_df = self._parse_mag_data(mag_raw) if mag_raw else pd.DataFrame()
        
        if plasma_df.empty and mag_df.empty:
            return pd.DataFrame()
        
        # Merge on time index
        if not plasma_df.empty and not mag_df.empty:
            df = plasma_df.join(mag_df, how='outer')
        elif not plasma_df.empty:
            df = plasma_df
        else:
            df = mag_df
        
        # Compute plasma beta
        # Beta = (n * k * T) / (B² / 2μ₀)
        # Simplified: beta ≈ 4.03e-6 * n * T / B²
        if 'density' in df.columns and 'temperature' in df.columns and 'bt' in df.columns:
            with np.errstate(divide='ignore', invalid='ignore'):
                df['beta'] = 4.03e-11 * df['density'] * df['temperature'] / (df['bt'] ** 2)
                df['beta'] = df['beta'].replace([np.inf, -np.inf], np.nan)
        else:
            df['beta'] = np.nan
        
        # Rename for consistency
        rename_map = {
            'bz_gsm': 'bz',
            'bx_gsm': 'bx',
            'by_gsm': 'by'
        }
        df = df.rename(columns=rename_map)
        
        # Select final columns
        final_cols = ['speed', 'density', 'temperature', 'bz', 'bt', 'beta']
        df = df[[c for c in final_cols if c in df.columns]]
        
        # Forward fill missing values (max 5 minutes)
        df = df.ffill(limit=5)
        
        # Cache
        if self.cache_enabled:
            self._cache[cache_key] = df
            self._cache_timestamp[cache_key] = datetime.now()
        
        return df
    
    def prepare_model_input(self, 
                            window_minutes: int = 60,
                            normalize: bool = True) -> Tuple[np.ndarray, Dict]:
        """
        Prepare data for model input
        
        Returns:
            Tuple of (input_array, metadata)
            input_array: Shape (1, window_minutes, 6)
            metadata: Dict with timestamp, raw values, etc.
        """
        df = self.get_realtime_data(days=1)
        
        if df.empty:
            raise ValueError("No data available from DSCOVR")
        
        # Get last N minutes
        df_window = df.tail(window_minutes)
        
        if len(df_window) < window_minutes:
            # Pad with last known values
            pad_count = window_minutes - len(df_window)
            last_row = df_window.iloc[-1:] if len(df_window) > 0 else pd.DataFrame()
            padding = pd.concat([last_row] * pad_count, ignore_index=True)
            df_window = pd.concat([padding, df_window], ignore_index=True)
        
        # Feature order
        features = ['speed', 'density', 'temperature', 'bz', 'bt', 'beta']
        
        # Fill any remaining NaN
        df_window = df_window[features].ffill().bfill()
        
        # Normalization parameters (from typical solar wind conditions)
        norm_params = {
            'speed': (400, 100),      # mean, std
            'density': (5, 5),
            'temperature': (100000, 50000),
            'bz': (0, 5),
            'bt': (5, 3),
            'beta': (1, 1)
        }
        
        data = df_window[features].values
        
        if normalize:
            for i, feat in enumerate(features):
                mean, std = norm_params[feat]
                data[:, i] = (data[:, i] - mean) / std
        
        # Shape: (1, seq_len, features)
        input_array = data.reshape(1, window_minutes, len(features))
        
        # Metadata
        metadata = {
            'timestamp': datetime.now().isoformat(),
            'data_points': len(df_window),
            'latest_values': {
                'speed': float(df_window['speed'].iloc[-1]),
                'density': float(df_window['density'].iloc[-1]),
                'bz': float(df_window['bz'].iloc[-1]) if 'bz' in df_window.columns else None,
            }
        }
        
        return input_array.astype(np.float32), metadata
    
    def get_current_conditions(self) -> Dict:
        """Get current space weather conditions summary"""
        df = self.get_realtime_data(days=1)
        
        if df.empty:
            return {'error': 'No data available'}
        
        latest = df.iloc[-1]
        
        # Determine conditions
        speed = latest.get('speed', 0)
        density = latest.get('density', 0)
        bz = latest.get('bz', 0)
        
        conditions = {
            'timestamp': datetime.now().isoformat(),
            'solar_wind': {
                'speed_km_s': float(speed) if pd.notna(speed) else None,
                'density_p_cm3': float(density) if pd.notna(density) else None,
                'speed_category': 'High' if speed > 500 else 'Moderate' if speed > 400 else 'Low'
            },
            'magnetic_field': {
                'bz_nT': float(bz) if pd.notna(bz) else None,
                'bz_direction': 'Southward (WARNING)' if bz < -5 else 'Northward' if bz > 0 else 'Neutral'
            },
            'storm_potential': 'High' if (speed > 500 and bz < -5) else 'Moderate' if (speed > 450 or bz < -3) else 'Low'
        }
        
        return conditions


# Testing
if __name__ == '__main__':
    print("=" * 60)
    print("DSCOVR Data Loader - Real-Time Test")
    print("=" * 60)
    
    loader = DSCOVRDataLoader()
    
    print("\n[INFO] Fetching real-time DSCOVR data...")
    df = loader.get_realtime_data(days=1)
    
    print(f"\nData shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nLatest values:")
    print(df.tail(5))
    
    print("\n[INFO] Current Conditions:")
    conditions = loader.get_current_conditions()
    print(json.dumps(conditions, indent=2))
    
    print("\n[INFO] Preparing model input...")
    try:
        input_array, metadata = loader.prepare_model_input(window_minutes=60)
        print(f"Input shape: {input_array.shape}")
        print(f"Metadata: {metadata}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n[OK] Data loader test complete!")
