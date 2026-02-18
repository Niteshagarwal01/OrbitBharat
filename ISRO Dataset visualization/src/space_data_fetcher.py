# Spacegen Real-Time Space Data Fetcher
# Developer: Nitesh Agarwal (2026)
# Uses SunPy, AstroPy, and spaceweather libraries for real satellite data

import os
import json
from datetime import datetime, timedelta
from pathlib import Path

# Try to import space ML libraries
try:
    import sunpy
    from sunpy.net import Fido, attrs as a
    from sunpy.time import TimeRange
    SUNPY_AVAILABLE = True
except ImportError:
    SUNPY_AVAILABLE = False
    print("SunPy not installed. Run: pip install sunpy")

try:
    from astropy import units as u
    from astropy.time import Time
    from astropy.coordinates import SkyCoord
    ASTROPY_AVAILABLE = True
except ImportError:
    ASTROPY_AVAILABLE = False
    print("AstroPy not installed. Run: pip install astropy")

try:
    import spaceweather
    SPACEWEATHER_AVAILABLE = True
except ImportError:
    SPACEWEATHER_AVAILABLE = False
    print("spaceweather not installed. Run: pip install spaceweather")

import requests
import pandas as pd
import numpy as np


class SpaceDataFetcher:
    """
    Real-time space weather data fetcher using multiple sources:
    - NASA DONKI API (CME, Flares, Storms)
    - NOAA SWPC (Real-time solar wind)
    - SunPy (Solar physics data)
    - AstroPy (Coordinate transformations)
    - spaceweather (Kp/Ap indices, F10.7 flux)
    """
    
    NASA_API_KEY = "DEMO_KEY"  # Replace with your NASA API key
    NOAA_BASE = "https://services.swpc.noaa.gov"
    NASA_DONKI = "https://api.nasa.gov/DONKI"
    
    def __init__(self, cache_dir="./cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.current_date = datetime.now()
        print(f"SpaceDataFetcher initialized - {self.current_date}")
    
    def get_server_date(self) -> str:
        """Get current date from reliable time server"""
        try:
            # Use worldtimeapi for accurate server time
            response = requests.get("http://worldtimeapi.org/api/ip", timeout=5)
            if response.ok:
                data = response.json()
                return data.get("datetime", "")[:10]
        except:
            pass
        return datetime.now().strftime("%Y-%m-%d")
    
    def fetch_noaa_realtime_solar_wind(self) -> dict:
        """Fetch real-time solar wind data from NOAA SWPC (DSCOVR satellite)"""
        print("Fetching real-time solar wind from NOAA...")
        try:
            url = f"{self.NOAA_BASE}/products/solar-wind/plasma-7-day.json"
            response = requests.get(url, timeout=30)
            if response.ok:
                data = response.json()
                # Skip header row, get latest readings
                readings = data[1:] if len(data) > 1 else []
                if readings:
                    latest = readings[-1]
                    return {
                        "timestamp": latest[0],
                        "density": float(latest[1]) if latest[1] else None,
                        "speed": float(latest[2]) if latest[2] else None,
                        "temperature": float(latest[3]) if latest[3] else None,
                        "source": "DSCOVR/NOAA"
                    }
        except Exception as e:
            print(f"NOAA solar wind error: {e}")
        return {}
    
    def fetch_noaa_xray_flux(self) -> dict:
        """Fetch real-time X-ray flux from GOES satellite"""
        print("Fetching GOES X-ray flux...")
        try:
            url = f"{self.NOAA_BASE}/json/goes/primary/xrays-7-day.json"
            response = requests.get(url, timeout=30)
            if response.ok:
                data = response.json()
                if len(data) > 1:
                    latest = data[-1]
                    return {
                        "timestamp": latest.get("time_tag"),
                        "flux": latest.get("flux"),
                        "energy": latest.get("energy"),
                        "source": "GOES"
                    }
        except Exception as e:
            print(f"GOES X-ray error: {e}")
        return {}
    
    def fetch_nasa_cme_events(self, days_back=30) -> list:
        """Fetch recent CME events from NASA DONKI"""
        print(f"Fetching CME events from last {days_back} days...")
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            url = (f"{self.NASA_DONKI}/CME?"
                   f"startDate={start_date.strftime('%Y-%m-%d')}&"
                   f"endDate={end_date.strftime('%Y-%m-%d')}&"
                   f"api_key={self.NASA_API_KEY}")
            response = requests.get(url, timeout=30)
            if response.ok:
                cmes = response.json()
                return [{
                    "time": cme.get("startTime"),
                    "location": cme.get("sourceLocation"),
                    "speed": cme.get("cmeAnalyses", [{}])[0].get("speed") if cme.get("cmeAnalyses") else None,
                    "type": cme.get("cmeAnalyses", [{}])[0].get("type") if cme.get("cmeAnalyses") else None,
                } for cme in (cmes or [])]
        except Exception as e:
            print(f"NASA CME error: {e}")
        return []
    
    def fetch_kp_index(self) -> dict:
        """Fetch current Kp index using spaceweather library or NOAA"""
        print("Fetching Kp index...")
        
        # Try spaceweather library first
        if SPACEWEATHER_AVAILABLE:
            try:
                # spaceweather provides historical Ap/Kp data
                kp_data = spaceweather.sw_daily()
                if not kp_data.empty:
                    latest = kp_data.iloc[-1]
                    return {
                        "kp_index": latest.get("Kp_mean", None),
                        "ap_index": latest.get("Ap", None),
                        "f107": latest.get("f107_obs", None),
                        "source": "spaceweather"
                    }
            except Exception as e:
                print(f"spaceweather error: {e}")
        
        # Fallback to NOAA API
        try:
            url = f"{self.NOAA_BASE}/products/noaa-planetary-k-index.json"
            response = requests.get(url, timeout=30)
            if response.ok:
                data = response.json()
                if len(data) > 1:
                    latest = data[-1]
                    return {
                        "timestamp": latest[0],
                        "kp_index": float(latest[1]) if latest[1] else None,
                        "source": "NOAA"
                    }
        except Exception as e:
            print(f"NOAA Kp error: {e}")
        return {}
    
    def fetch_sunpy_data(self, instrument="aia", wavelength=171) -> dict:
        """Fetch solar data using SunPy (requires SunPy installation)"""
        if not SUNPY_AVAILABLE:
            return {"error": "SunPy not installed"}
        
        print(f"Fetching SunPy data: {instrument} @ {wavelength}Å...")
        try:
            # Search for recent AIA data
            time_range = TimeRange(
                datetime.now() - timedelta(hours=1),
                datetime.now()
            )
            
            result = Fido.search(
                a.Time(time_range),
                a.Instrument.aia,
                a.Wavelength(wavelength * u.angstrom)
            )
            
            return {
                "found": len(result) > 0,
                "count": len(result[0]) if len(result) > 0 else 0,
                "instrument": instrument,
                "wavelength": wavelength,
                "source": "SunPy/VSO"
            }
        except Exception as e:
            print(f"SunPy error: {e}")
            return {"error": str(e)}
    
    def get_comprehensive_space_weather(self) -> dict:
        """Get comprehensive space weather summary from all sources"""
        print("=" * 60)
        print(f"Spacegen Space Weather Report - {self.get_server_date()}")
        print("=" * 60)
        
        return {
            "date": self.get_server_date(),
            "timestamp": datetime.now().isoformat(),
            "solar_wind": self.fetch_noaa_realtime_solar_wind(),
            "xray_flux": self.fetch_noaa_xray_flux(),
            "kp_index": self.fetch_kp_index(),
            "recent_cmes": self.fetch_nasa_cme_events(days_back=7),
            "sunpy_available": SUNPY_AVAILABLE,
            "astropy_available": ASTROPY_AVAILABLE,
            "spaceweather_available": SPACEWEATHER_AVAILABLE,
        }
    
    def save_to_cache(self, data: dict, filename: str):
        """Save data to local cache"""
        cache_file = self.cache_dir / filename
        with open(cache_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        print(f"Cached: {cache_file}")


# Main execution
if __name__ == "__main__":
    fetcher = SpaceDataFetcher()
    
    # Get comprehensive report
    report = fetcher.get_comprehensive_space_weather()
    
    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Date: {report['date']}")
    print(f"Solar Wind Speed: {report['solar_wind'].get('speed', 'N/A')} km/s")
    print(f"Proton Density: {report['solar_wind'].get('density', 'N/A')} p/cm³")
    print(f"Kp Index: {report['kp_index'].get('kp_index', 'N/A')}")
    print(f"CMEs (7 days): {len(report['recent_cmes'])}")
    print(f"X-ray Flux: {report['xray_flux'].get('flux', 'N/A')}")
    
    # Save to cache
    fetcher.save_to_cache(report, f"space_weather_{report['date']}.json")
