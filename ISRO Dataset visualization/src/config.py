"""
Configuration file for ISRO CME Detection System
Replace hardcoded paths with configurable settings
"""
import os
from pathlib import Path

# Base directory - can be overridden with environment variable
BASE_DIR = Path(os.environ.get('CME_DATA_DIR', Path(__file__).parent.parent))

# Data directories
DATA_DIR = BASE_DIR / 'cdf_data'
OUTPUT_DIR = BASE_DIR / 'output'
MODEL_DIR = BASE_DIR / 'models'

# Create directories if they don't exist
for dir_path in [DATA_DIR, OUTPUT_DIR, MODEL_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Model configuration
MODEL_CONFIG = {
    'input_size': 6,
    'hidden_size': 64,
    'num_layers': 2,
    'dropout': 0.2,
    'sequence_length': 50,
    'batch_size': 32,
    'num_epochs': 50,
    'learning_rate': 0.001,
}

# Data processing configuration
DATA_CONFIG = {
    'selected_features': [
        'proton_bulk_speed',
        'proton_density', 
        'alpha_density',
        'spacecraft_xpos',
        'spacecraft_ypos',
        'spacecraft_zpos'
    ],
    'train_split': 0.8,
    'alpha_proton_threshold': 0.08,
    'speed_threshold': 500,
}

# CME detection thresholds
CME_THRESHOLDS = {
    'speed_enhancement': 50,      # km/s
    'density_enhancement': 1.5,   # factor
    'temperature_decrease': 0.7,  # factor
    'duration_min_hours': 2,
    'duration_max_hours': 24,
}

def get_cdf_files(date_folder: str = None):
    """
    Get list of CDF files from data directory
    
    Args:
        date_folder: Optional date folder (e.g., '20250621')
    
    Returns:
        List of file paths
    """
    if date_folder:
        search_dir = DATA_DIR / date_folder
    else:
        search_dir = DATA_DIR
    
    if not search_dir.exists():
        return []
    
    return list(search_dir.glob('*.cdf'))
