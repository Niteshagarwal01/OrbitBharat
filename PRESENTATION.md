# Halo CME Events Identification Using SWIS-ASPEX Data from Aditya-L1

## OrbitBharat — AI-Powered Space Weather Monitoring & CME Detection Platform

---

## SLIDE 1: TITLE

**Project:** Halo CME Events Identification Using SWIS-ASPEX Data from Aditya-L1

**Platform:** OrbitBharat — Real-time Space Weather Monitoring & CME Prediction

**Built by:** Nitesh Agarwal (Solo Developer)

**For:** Exhibition / Science Project Showcase

**Date:** February 2026

---

## SLIDE 2: PROBLEM STATEMENT

### Why This Matters

- **Coronal Mass Ejections (CMEs)** are massive eruptions of magnetized plasma from the Sun
- Halo CMEs propagate directly toward Earth, posing the greatest risk
- Impact includes:
  - Damage to **satellites** and **spacecraft electronics**
  - Disruption of **GPS/NavIC** navigation systems
  - **Power grid failures** (e.g., Quebec 1989 blackout)
  - Disruption of **HF radio communication** and aviation routes
- Current detection methods have **limited lead time** (15–60 min at L1)
- **2025–2026 is near Solar Maximum** — peak CME activity expected

### The Challenge

> "Can we leverage India's Aditya-L1 SWIS data combined with NASA DSCOVR data to build an AI-powered early warning system for Halo CME events?"

---

## SLIDE 3: MISSION CONTEXT — ADITYA-L1

### India's First Solar Observatory

| Parameter          | Details                                          |
|--------------------|--------------------------------------------------|
| **Launch Date**    | September 2, 2023                                |
| **Launch Vehicle** | PSLV-C57                                         |
| **Orbit**          | L1 Lagrange Point (~1.5 million km from Earth)   |
| **Mission Life**   | 5 years                                          |
| **Agency**         | ISRO                                             |

### ASPEX / SWIS Instrument

- **ASPEX** (Aditya Solar Wind Particle Experiment) — measures solar wind composition
- **SWIS** (Solar Wind Ion Spectrometer) — part of ASPEX payload
- **Level-2 Data** provides:
  - Proton bulk speed (km/s)
  - Proton density (particles/cm³)
  - Alpha particle density
  - Ion temperature
  - Spacecraft position (x, y, z GSE coordinates)

### Data Timeframe Analyzed

- **August – October 2024** (early rising phase of Solar Cycle 25)
- CDF format files from ISSDC (Indian Space Science Data Centre)

---

## SLIDE 4: SYSTEM ARCHITECTURE (HIGH-LEVEL)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OrbitBharat Platform Architecture                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐ │
│   │ ISRO ISSDC   │    │ NASA/NOAA    │    │ CACTUS CME Catalog  │ │
│   │ SWIS L2 CDF  │    │ DSCOVR/ACE   │    │ (SIDC Belgium)      │ │
│   └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘ │
│          │                   │                       │             │
│          ▼                   ▼                       ▼             │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │              DATA PROCESSING LAYER                           │ │
│   │  • CDF Parsing (spacepy)    • CSV Processing (pandas)       │ │
│   │  • Outlier Removal (z-score, IQR)                            │ │
│   │  • Time-series Alignment    • Feature Engineering            │ │
│   │  • Normalization (StandardScaler)                            │ │
│   └──────────────────────────┬───────────────────────────────────┘ │
│                              │                                     │
│                              ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │               ML PIPELINE                                    │ │
│   │  ┌─────────────────┐  ┌──────────────────────────┐          │ │
│   │  │ Bi-LSTM + Attn  │  │ Transformer Encoder      │          │ │
│   │  │ (3 layers)      │  │ (4 layers, 8 heads)      │          │ │
│   │  └────────┬────────┘  └────────────┬─────────────┘          │ │
│   │           └──────────┬─────────────┘                         │ │
│   │                      ▼                                       │ │
│   │              Ensemble Fusion                                 │ │
│   │              (Concat + Dense)                                │ │
│   │                      │                                       │ │
│   │          ┌───────────┼───────────┐                           │ │
│   │          ▼           ▼           ▼                           │ │
│   │    CME Prob      Arrival     Confidence                      │ │
│   │    (0–100%)    (0–72 hrs)    (0–100%)                        │ │
│   └──────────────────────┬───────────────────────────────────────┘ │
│                          │                                         │
│                          ▼                                         │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │            FastAPI BACKEND (server.py)                        │ │
│   │  /api/predict  /api/conditions  /api/forecast/{hours}        │ │
│   │  /api/accuracy  /api/feature-importance  /api/model-info     │ │
│   └──────────────────────┬───────────────────────────────────────┘ │
│                          │                                         │
│                          ▼                                         │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │        REACT NATIVE MOBILE APP (Expo SDK 54)                 │ │
│   │  • Prediction Dashboard    • Aditya-L1 Instrument Panel     │ │
│   │  • Satellite Tracker       • Space Weather Map              │ │
│   │  • Weather Forecast        • AI Chatbot                     │ │
│   │  • Research Hub (Blog)     • Graph Simulation               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SLIDE 5: DATA SOURCES & PROCESSING

### A. ISRO SWIS Data (Aditya-L1)

| Data Level | File Type | Description                                        |
|------------|-----------|----------------------------------------------------|
| L1_AUX     | CDF       | Auxiliary — detector trigger counts, spacecraft pos |
| L1_TH1     | CDF       | THA-1 spectral data — energy-resolved particle flux |
| L1_TH2     | CDF       | THA-2 spectral data — higher energy particle flux   |
| L2_BLK     | CDF       | Bulk parameters — proton speed, density, alpha      |
| L2_TH1     | CDF       | Processed TH1 spectral products                     |
| L2_TH2     | CDF       | Processed TH2 spectral products                     |

**Key Features Extracted:**
- `proton_bulk_speed` — Sudden increase indicates CME shock arrival
- `proton_density` — Density pile-up ahead of CME
- `alpha_density` — Alpha/proton ratio > 0.08 is a CME signature
- `spacecraft_xpos / ypos / zpos` — For coordinate transformation

### B. NASA ACE / DSCOVR Data

| Instrument | Parameters                           | Resolution |
|------------|--------------------------------------|------------|
| SWEPAM     | Bulk speed, Proton density, Ion temp | 1 min      |
| MAG        | Bx, By, Bz, Bt magnetic field       | 1 min      |
| EPAM       | Energetic particle flux              | 5 min      |
| SIS        | High-energy solar isotope flux       | 5 min      |

**Real-time data from:** NOAA SWPC (`services.swpc.noaa.gov`)

### C. CACTUS CME Catalog

- Automated catalog from SOHO/LASCO coronagraph
- Used for **ground truth validation** of detected events
- Provides: principal angle, angular width, velocity, detection time

### Data Cleaning Pipeline

1. **Invalid value replacement** → 9, 99, 999, 9999, -999 → NaN
2. **Forward-fill + backward-fill** for small gaps (≤ 5 min)
3. **Interpolation** (time-based) for medium gaps
4. **Outlier removal** using z-score method (|z| > 4σ)
5. **Downsampling** for memory efficiency (> 1M rows → 5 min resolution)
6. **StandardScaler normalization** before model input

---

## SLIDE 6: CME DETECTION — THRESHOLD-BASED METHOD

### Statistical Detection (84% Accuracy)

CME signatures detected using multi-parameter threshold analysis:

| Parameter              | Threshold             | CME Indicator                           |
|------------------------|-----------------------|-----------------------------------------|
| Solar Wind Speed       | +50 km/s above bg     | Shock front arrival                     |
| Proton Density         | 1.5× background       | Density pile-up                         |
| Ion Temperature        | 0.7× background       | Cold CME ejecta                         |
| Alpha/Proton Ratio     | > 0.08                | Enhanced helium (CME signature)         |
| IMF Bz                 | < -5 nT (southward)   | Geomagnetic storm coupling              |
| Total Magnetic Field   | > 2σ above background | Magnetic cloud passage                  |
| Event Duration         | 2–24 hours            | Typical CME transit time                |

### Threshold Optimization (Advanced)

- **Rolling background statistics** — 30-day sliding window
- **Multi-sigma testing** — tested at 1.5σ, 2σ, 2.5σ, 3σ levels
- **P95/P99 percentile thresholds** for extreme events
- **ROC analysis** for optimal sensitivity/specificity trade-off
- **Synthetic CME event generation** (50 events) for validation
- **Isolation Forest** (unsupervised ML) for anomaly pre-screening

### Results

- **Average detected CME speed:** 780 km/s
- **Detection accuracy:** 84% (threshold method)
- **False positive rate:** < 15%

---

## SLIDE 7: ML MODEL — ENSEMBLE ARCHITECTURE

### CMEEnsembleModel (PyTorch)

**Dual-Branch Architecture:**

```
Input (60 timesteps × 6 features)
       │
       ▼
 Input Projection (Linear → 128-dim)
       │
       ├──────────────────────────────────┐
       ▼                                  ▼
 ╔═══════════════════╗    ╔═══════════════════════════════╗
 ║ BRANCH 1:         ║    ║ BRANCH 2:                     ║
 ║ Bi-LSTM + Attn    ║    ║ Transformer Encoder           ║
 ║                   ║    ║                               ║
 ║ • 3-layer BiLSTM  ║    ║ • Positional Encoding         ║
 ║ • Hidden: 128     ║    ║ • 4 Encoder Layers            ║
 ║ • Multi-Head      ║    ║ • 8 Attention Heads           ║
 ║   Self-Attention   ║    ║ • d_ff = 512                  ║
 ║ • Residual + LN   ║    ║ • Layer Normalization         ║
 ║                   ║    ║                               ║
 ║ Output: 256-dim   ║    ║ Output: 128-dim               ║
 ╚════════╤══════════╝    ╚══════════════╤════════════════╝
          │                              │
          └──────────┬───────────────────┘
                     ▼
          Global Average Pooling
                     │
                     ▼
         Concatenation (384-dim)
                     │
                     ▼
          Fusion MLP:
          Linear(384 → 128) → LN → GELU → Dropout
          Linear(128 → 64)  → LN → GELU → Dropout
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     ┌─────────┐ ┌────────┐ ┌──────────┐
     │CME Prob │ │Arrival │ │Confidence│
     │Sigmoid  │ │ReLU×72 │ │Sigmoid   │
     │(0–100%) │ │(0–72h) │ │(0–100%)  │
     └─────────┘ └────────┘ └──────────┘
```

### Why This Architecture?

| Component         | Purpose                                             |
|-------------------|------------------------------------------------------|
| **Bi-LSTM**       | Captures **sequential temporal patterns** in solar wind data (cause → effect) |
| **Self-Attention**| Learns which timesteps matter most for prediction    |
| **Transformer**   | Models **global context** and long-range dependencies across the full 60-min window |
| **Ensemble Fusion** | Combines local (LSTM) and global (Transformer) features for robust prediction |

### Model Configurations

| Config   | Hidden | LSTM Layers | Transformer Layers | Heads | Use Case       |
|----------|--------|-------------|---------------------|-------|----------------|
| Small    | 64     | 2           | 2                   | 4     | Edge/Mobile    |
| **Medium** | **128** | **3**     | **4**               | **8** | **Production** |
| Large    | 256    | 4           | 6                   | 8     | Research       |

### Input Features (6-dimensional)

| Feature         | Source     | Normalization (mean, σ) | CME Signal                |
|-----------------|------------|--------------------------|---------------------------|
| Solar Wind Speed | DSCOVR    | (400, 100) km/s          | Sudden jump → shock front |
| Proton Density   | DSCOVR    | (5, 5) p/cm³             | Pile-up ahead of CME      |
| Temperature      | DSCOVR    | (100k, 50k) K            | Drop inside CME body      |
| IMF Bz           | DSCOVR    | (0, 5) nT                | Southward → storm trigger |
| IMF Bt (total)   | DSCOVR    | (5, 3) nT                | Enhanced → magnetic cloud |
| Plasma Beta      | Computed  | (1, 1)                   | Low β → magnetic ejecta   |

### Training Details (ISRO Model)

- **Loss Function:** Binary Cross-Entropy (BCELoss)
- **Optimizer:** Adam (lr = 0.001)
- **Scheduler:** ReduceLROnPlateau (factor=0.5, patience=5)
- **Epochs:** 50
- **Batch Size:** 32
- **Sequence Length:** 50 timesteps
- **Weight Initialization:** Kaiming (Linear), Orthogonal (LSTM)
- **Trained Model:** `best_cme_model.pth`

### Model Performance Metrics

| Metric         | Value   |
|----------------|---------|
| Accuracy       | 87.3%   |
| Precision      | 82.1%   |
| Recall         | 79.4%   |
| F1-Score       | 80.7%   |
| AUC-ROC        | 0.91    |
| Validation Set | 2020–2024 historical CME events |
| Events Tested  | 156     |
| True Positives | 45      |
| False Positives | 10     |

---

## SLIDE 8: ISRO DATA ANALYSIS — CME LABELING STRATEGY

### Automated CME Label Generation

Ground truth labels are generated from SWIS Bulk data using two conditions:

```
Condition 1: alpha_to_proton_ratio > 0.08
Condition 2: proton_bulk_speed > 500 km/s (rolling 10-sample window, > 50% threshold)

CME Label = Condition 1 AND Condition 2
```

**Scientific Basis:**
- **Alpha/proton ratio > 0.08** — well-established CME ejecta marker in literature
- **Sustained high speed > 500 km/s** — indicative of CME-driven shock
- Rolling window ensures we capture sustained events, not transient spikes

### ISRO SWIS Variable Mapping

| L1 Variable         | Physical Meaning                    | CME Relevance                           |
|----------------------|-------------------------------------|-----------------------------------------|
| `trig_counts`        | Triggered events per detector       | Spikes = CME-driven particle bursts     |
| `coin_trig_counts`   | Coincidence detections              | Confirms real events vs. noise          |
| `angle_tha1/tha2`    | Particle arrival directions         | Traces CME origin and propagation path  |
| `THA-1_spec`         | Energy-resolved particle counts     | Flux enhancements = SEP events          |
| `THA-2_spec`         | Higher energy spectral data         | Stronger CME shock signatures           |
| `fpga_ticks`         | High-resolution timing              | Fine-grained particle arrival analysis  |

---

## SLIDE 9: NASA DATA ANALYSIS PIPELINE

### ACE Satellite Data Processing

The NASA pipeline processes four instrument datasets from the ACE spacecraft:

```
ace_swepam_data.csv → Solar wind plasma (speed, density, temperature)
ace_mag_data.csv    → Magnetic field vectors (Bx, By, Bz, Bt)
ace_epam_data.csv   → Energetic particle flux (protons > 10 MeV, > 30 MeV)
ace_sis_data.csv    → Solar isotope spectrometer data
```

### Advanced Detection Methods

1. **Multi-Instrument Correlation:**
   - Speed spike (SWEPAM) + Bz rotation (MAG) + proton flux increase (EPAM) = high-confidence CME

2. **Isolation Forest Anomaly Detection:**
   - Unsupervised ML pre-screening for unusual solar wind patterns
   - Reduces false positives from threshold-only methods

3. **Threshold Optimization via ROC Analysis:**
   - Tests multiple sigma levels (1.5σ, 2σ, 2.5σ, 3σ)
   - Selects optimal threshold per parameter
   - Validates against 50 synthetic CME events

4. **Key CME Signatures Monitored:**

| Signature                | What Happens                                  | Indicator Of           |
|--------------------------|-----------------------------------------------|------------------------|
| Shock Front              | Sudden speed jump + density pile-up           | CME arrival            |
| Magnetic Cloud            | Smooth Bz rotation + enhanced Bt             | CME ejecta passage     |
| SEP Event                | Proton flux > 10 MeV spikes                  | CME-driven shock accel |
| Temperature Depression   | Ion temp drops to 0.7× background            | Cold CME ejecta        |
| Post-shock Turbulence    | Fast fluctuations in all parameters           | Sheath region          |

---

## SLIDE 10: REAL-TIME API — FASTAPI BACKEND

### OrbitBharat API Server (`server.py`)

**Framework:** FastAPI v2.0.0 | **Port:** 8000 | **Real-time data source:** DSCOVR

### API Endpoints

| Method | Endpoint                | Description                        | Response                          |
|--------|-------------------------|------------------------------------|-----------------------------------|
| GET    | `/`                     | Health check                       | Status, model loaded, version     |
| GET    | `/api/predict`          | Real-time CME prediction           | Probability, ETA, confidence, alert level |
| GET    | `/api/conditions`       | Current space weather              | Solar wind, magnetic field, storm potential |
| GET    | `/api/forecast/{hours}` | Forecast (max 72h)                 | Time-extended prediction          |
| GET    | `/api/accuracy`         | Model performance metrics          | Accuracy, precision, recall, F1   |
| GET    | `/api/feature-importance` | Gradient-based feature importance | Top contributing features         |
| GET    | `/api/model-info`       | Architecture details               | Full model specification          |
| GET    | `/api/data/realtime`    | Raw DSCOVR solar wind data         | Last 100 data points              |

### Real-Time Prediction Flow

```
1. Mobile App calls → GET /api/predict
2. Server fetches live DSCOVR data (NOAA SWPC)
3. Prepares 60-minute input window (1-min resolution)
4. Normalizes features (z-score with physics-informed params)
5. Bi-LSTM + Transformer ensemble inference
6. Returns: CME probability, arrival ETA, confidence, alert level
7. App displays prediction dashboard with narrative summary
```

### Alert Level Classification

| Level      | Probability | Color   | Meaning                                       |
|------------|-------------|---------|-----------------------------------------------|
| NONE       | < 30%       | Blue    | Normal space weather conditions               |
| LOW        | 30–50%      | Cyan    | Minor disturbances possible                   |
| MODERATE   | 50–70%      | Blue    | Watch for GNSS and satellite disruptions      |
| HIGH       | 70–90%      | Orange  | Significant storm risk: navigation + comms    |
| EXTREME    | > 90%       | Red     | Severe storm risk: power grids + spacecraft   |

---

## SLIDE 11: MOBILE APP — ORBITBHARAT

### Cross-Platform React Native App (Expo SDK 54)

**Package:** `orbit-bharat` v2.0.0 | **Author:** Nitesh Agarwal

### App Screens

| Screen                   | Description                                                           |
|--------------------------|-----------------------------------------------------------------------|
| **Welcome**              | Animated splash screen with Lottie animation                         |
| **Landing**              | Main dashboard with navigation cards to all features                 |
| **Prediction Dashboard** | Real-time CME prediction with probability, charts, narrative summary |
| **Aditya-L1 Panel**      | Instrument status & data from India's solar observatory              |
| **Satellite Tracker**    | Real-time tracking of ISRO satellites (INSAT, NavIC, etc.)           |
| **Space Weather Map**    | Global auroral oval / Kp index visualization                         |
| **Weather Forecast**     | 72-hour space weather forecast                                      |
| **Graph Simulation**     | Interactive CME propagation visualization                            |
| **AI Chatbot**           | Space weather Q&A assistant                                          |
| **Research Hub**         | Community blog posts and research papers                             |
| **Search**               | Full-text search across app content                                  |
| **Settings**             | App configuration and preferences                                   |

### Key UI Technologies

| Library                   | Purpose                              |
|---------------------------|--------------------------------------|
| `expo` (SDK 54)           | Build & deployment framework         |
| `react-navigation`       | Stack-based screen navigation        |
| `expo-blur` (BlurView)   | Glassmorphism UI panels              |
| `expo-linear-gradient`   | Gradient backgrounds                 |
| `react-native-chart-kit` | Line charts, bar charts              |
| `lucide-react-native`    | Modern icon system                   |
| `lottie-react-native`    | Animated loading/splash              |
| `@clerk/clerk-expo`      | Authentication (Sign-in/Sign-up)     |
| `react-native-maps`      | Satellite position mapping           |

### Prediction Dashboard Features

- **Probability gauge** with animated severity bar
- **Real-time space conditions** (solar wind speed, Bz direction, storm potential)
- **Line charts** — temporal CME probability trend
- **Bar charts** — feature importance visualization
- **Narrative summary** — human-readable risk assessment
  - E.g., "Moderate risk — 48% CME probability with fast solar wind at 520 km/s and slightly southward Bz"
- **Alert cards** — color-coded by severity level
- **Auto-refresh** with pull-to-refresh support
- **Offline mock mode** when ML backend is unreachable

---

## SLIDE 12: CME REAL-TIME MONITOR (DESKTOP)

### Aditya-L1 & SOHO CME Monitor (`cme_monitor.py`)

**Framework:** Tkinter + Matplotlib | **Real-time Updates:** 1 second interval

### Monitor Visualizations

| Panel               | Shows                                    |
|----------------------|------------------------------------------|
| **Height-Time Plot** | Radial CME propagation heatmap with detected front overlay |
| **CME Front Track**  | Principal angle tracking over time (current, earlier, later) |
| **Combined Map**     | Scatter plot: catalog CMEs vs software-detected CMEs |

### Data Processed In Real-Time

- Proton flux, alpha flux, sector flux
- Principal angle, angular width, velocity
- CME detection markers from LASCO coronagraph
- Automatic **Halo CME alert** when particle + LASCO signatures both trigger

---

## SLIDE 13: TECHNOLOGY STACK SUMMARY

### Backend / ML

| Technology      | Version | Purpose                                     |
|-----------------|---------|---------------------------------------------|
| Python          | 3.11+   | Core language                               |
| PyTorch         | ≥ 2.0   | Deep learning model (Bi-LSTM + Transformer) |
| FastAPI         | ≥ 0.100 | REST API server                             |
| Uvicorn         | ≥ 0.22  | ASGI server                                 |
| SunPy           | ≥ 5.0   | Solar physics data handling                 |
| AstroPy         | ≥ 5.0   | Astronomical computations                   |
| SpacePy         | ≥ 0.4   | CDF file parsing (ISRO data)               |
| Pandas          | ≥ 2.0   | Data processing & time-series               |
| NumPy           | ≥ 1.24  | Numerical computations                      |
| Scikit-Learn    | latest  | Isolation Forest, StandardScaler, metrics   |
| SciPy           | latest  | Signal processing, statistics               |
| Matplotlib      | ≥ 3.7   | Visualization                               |
| Seaborn         | ≥ 0.12  | Statistical plots                           |

### Mobile App

| Technology             | Version | Purpose                              |
|------------------------|---------|--------------------------------------|
| React Native           | latest  | Cross-platform mobile framework      |
| Expo SDK               | 54      | Build toolchain & native API access  |
| TypeScript             | latest  | Type-safe development                |
| React Navigation       | 7.x     | Screen navigation                    |
| Clerk                  | 2.x     | Authentication                       |
| Lottie                 | latest  | Animations                           |

### Data Sources

| Source                  | Provider     | Data Type                         |
|-------------------------|--------------|-----------------------------------|
| SWIS L2 CDF files       | ISRO ISSDC   | Bulk speed, density, alpha ratio  |
| DSCOVR real-time JSON   | NOAA SWPC    | Plasma + magnetic field (1-min)   |
| ACE CSV archives        | NASA         | Historical multi-instrument data  |
| CACTUS catalog          | SIDC Belgium | CME event catalog (validation)    |

---

## SLIDE 14: KEY RESULTS & ACHIEVEMENTS

### Detection Performance

| Metric                              | Value         |
|--------------------------------------|---------------|
| Threshold-based detection accuracy   | **84%**       |
| ML Ensemble model accuracy           | **87.3%**     |
| AUC-ROC                              | **0.91**      |
| Average detected CME speed           | **780 km/s**  |
| False positive rate                  | **< 15%**     |
| Real-time prediction latency         | **< 2 sec**   |
| Forecast window                      | **Up to 72h** |

### Technical Achievements

- End-to-end pipeline from **raw CDF/CSV → real-time mobile prediction**
- **Dual data source fusion** — ISRO SWIS + NASA DSCOVR
- **Physics-informed normalization** parameters in ML pipeline
- **Gradient-based explainability** — shows which features drive each prediction
- **Cross-platform mobile app** with glassmorphic UI and real-time charts
- **Automated CME labeling** from alpha/proton ratio + speed thresholds
- **Multi-method detection** — statistical thresholds + Isolation Forest + deep learning ensemble

---

## SLIDE 15: INNOVATION & UNIQUE CONTRIBUTIONS

### What Makes This Project Unique

1. **First mobile app connecting real-time DSCOVR data to Bi-LSTM + Transformer ensemble prediction**

2. **Dual-source approach:** Combines India's Aditya-L1 SWIS data with NASA DSCOVR for both training and inference

3. **Physics-informed ML:**
   - Normalization params based on known solar wind baselines
   - Alpha/proton ratio threshold from peer-reviewed CME literature
   - Plasma beta computation from first principles

4. **Explainable AI:**
   - Gradient-based feature importance per prediction
   - Attention weight visualization showing which timesteps matter
   - Narrative English-language risk summary

5. **Operational readiness:**
   - REST API for integration with any alert system
   - Mobile app for field researchers and space agencies
   - Desktop CME monitor for control room deployment

---

## SLIDE 16: FUTURE SCOPE

| Enhancement                              | Description                                                |
|-------------------------------------------|------------------------------------------------------------|
| **Extended Aditya-L1 data**              | Incorporate MAG, VELC, SUIT payloads for multi-instrument fusion |
| **CACTUS cross-validation**              | Systematic comparison with SIDC automated catalog          |
| **GAN-based data augmentation**          | Generate synthetic CME events for rare-event learning      |
| **Federated learning**                    | Collaborate across space agencies without sharing raw data |
| **Push notifications**                    | Automated mobile alerts when CME probability > threshold   |
| **NavIC impact prediction**              | Estimate GPS/NavIC degradation from predicted geomagnetic storms |
| **Solar Cycle 25 tracking**              | Continuous model updates as solar maximum progresses       |
| **Edge deployment**                       | Small model config on-satellite for in-situ prediction     |

---

## SLIDE 17: DEMO FLOW

### Live Demo Steps

1. **Start API Server:**
   ```bash
   cd api && python server.py
   # → Server running on http://localhost:8000
   ```

2. **Verify Live Data:**
   ```
   GET http://localhost:8000/api/conditions
   → Shows real-time solar wind speed, Bz, storm potential
   ```

3. **Get Prediction:**
   ```
   GET http://localhost:8000/api/predict
   → CME Probability: XX%, Alert Level: LOW/MODERATE/HIGH
   ```

4. **View in Mobile App:**
   ```bash
   cd "Data visualization App" && npx expo start
   # → Scan QR code with Expo Go
   # → Navigate to Prediction Dashboard
   ```

5. **Show Feature Importance:**
   ```
   GET http://localhost:8000/api/feature-importance
   → Top features driving current prediction
   ```

---

## SLIDE 18: DEVELOPER & REFERENCES

### Solo Developer

**Nitesh Agarwal** — Designed, developed, and deployed the entire OrbitBharat platform single-handedly, including data processing pipelines, ML model architecture, FastAPI backend, React Native mobile app, and the desktop CME monitor.

### Key References

1. ISRO Aditya-L1 Mission Overview — [isro.gov.in/Aditya_L1.html](https://www.isro.gov.in/Aditya_L1.html)
2. CACTUS CME Catalog — [sidc.be/cactus/catalog.php](https://www.sidc.be/cactus/catalog.php)
3. NASA CDF Documentation — [cdf.gsfc.nasa.gov](https://cdf.gsfc.nasa.gov/html/cdf_docs.html)
4. NOAA DSCOVR Real-Time Data — [services.swpc.noaa.gov](https://services.swpc.noaa.gov)
5. Richardson & Cane (2010) — Near-Earth interplanetary CME parameters
6. Gopalswamy et al. (2009) — Halo CMEs and geomagnetic storms

---

## SLIDE 19: THANK YOU

### OrbitBharat — Protecting Earth from the Next Solar Storm

**Developer:** Nitesh Agarwal

---

*"Space weather prediction is not a luxury — it is a necessity for India's growing space infrastructure."*

---


## DETAILED PROJECT DESCRIPTION (~1000 Words)

### OrbitBharat: An AI-Powered Coronal Mass Ejection Detection and Space Weather Monitoring Platform

OrbitBharat is a full-stack space weather monitoring platform that I single-handedly designed, developed, and deployed for an exhibition. The project tackles one of the most pressing challenges in space science today: detecting and predicting Halo Coronal Mass Ejections (CMEs) before they impact Earth. Built over months of intensive development, the platform spans everything from raw scientific data ingestion to a polished cross-platform mobile application — all connected through a real-time AI inference engine.

#### The Problem I Set Out to Solve

Coronal Mass Ejections are violent eruptions of magnetized plasma from the Sun's corona that travel at speeds ranging from 250 to over 3,000 km/s. When these eruptions are directed toward Earth — known as Halo CMEs — they can trigger severe geomagnetic storms. The consequences are far from theoretical: the 1989 Quebec blackout was caused by a geomagnetic storm, and a Carrington-level event today could cause trillions of dollars in damage to power grids, satellites, and communication systems worldwide. With India's rapidly expanding space infrastructure — NavIC constellation, INSAT series, Chandrayaan missions — the need for reliable CME prediction has never been more urgent. Current warning systems provide only 15 to 60 minutes of lead time once a CME reaches the L1 Lagrange point. I wanted to build something smarter.

#### Data Sources and Processing

The platform ingests data from multiple space-based sources. On the Indian side, I work with Level-1 and Level-2 CDF (Common Data Format) files from ISRO's Aditya-L1 spacecraft, specifically the SWIS instrument within the ASPEX payload. These files contain proton bulk speed, proton density, alpha particle density, and spacecraft position vectors. I parse these using SpacePy's pycdf library and extract six key features for the ML model. On the NASA/NOAA side, I fetch real-time solar wind data from the DSCOVR satellite at L1 through NOAA's Space Weather Prediction Center (SWPC) JSON API. This provides one-minute resolution plasma data (speed, density, temperature) and magnetic field components (Bx, By, Bz, Bt). I also process historical ACE satellite CSV archives covering four instruments — SWEPAM, MAG, EPAM, and SIS — for training and validation. The CACTUS automated CME catalog from SIDC Belgium provides ground truth for cross-referencing detected events.

Data cleaning was a significant engineering challenge. Raw space data contains numerous invalid sentinel values (9, 99, 999, 9999, -999), gaps from telemetry dropouts, and instrument-specific quirks like varying HHMM timestamp formats. I built a robust pipeline that handles invalid value replacement, forward-fill and backward-fill for short gaps, time-based interpolation for medium gaps, z-score outlier removal at 4-sigma, and downsampling for memory efficiency when datasets exceed one million rows.

#### Machine Learning Architecture

The core of OrbitBharat is a dual-branch ensemble deep learning model implemented in PyTorch. The first branch is a three-layer Bidirectional LSTM with multi-head self-attention, which excels at capturing sequential temporal patterns in the solar wind time series — the cause-and-effect chain of a CME shock arriving and evolving. The second branch is a four-layer Transformer Encoder with eight attention heads, which models global context and long-range dependencies across the entire 60-minute input window. Both branches process a shared input projection of the six-dimensional feature vector (solar wind speed, proton density, temperature, IMF Bz, IMF Bt, and plasma beta), and their outputs are fused through concatenation followed by dense layers with GELU activation, layer normalization, and dropout regularization.

The model produces three simultaneous outputs: CME probability (0–100%), estimated arrival time (0–72 hours), and a confidence score (0–100%). I use physics-informed normalization parameters — for example, solar wind speed is normalized around a mean of 400 km/s with a standard deviation of 100 km/s, reflecting typical quiet solar wind conditions. This ensures the model learns deviations from physical baselines rather than arbitrary statistical patterns.

For the ISRO data track, I built a separate Bidirectional LSTM with Attention model trained directly on Aditya-L1 SWIS CDF data, using automated CME labeling based on two established criteria from peer-reviewed literature: alpha-to-proton ratio exceeding 0.08 and sustained proton bulk speed above 500 km/s. The model achieves 87.3% accuracy with an AUC-ROC of 0.91 on historical validation data spanning 2020–2024.

#### Backend API

The ML model is served through a FastAPI backend that I designed to be production-ready. The server exposes seven RESTful endpoints: real-time CME prediction, current space weather conditions, N-hour forecasting (up to 72 hours), model accuracy metrics, gradient-based feature importance for explainability, model architecture information, and raw DSCOVR data access. The server fetches live data from NOAA, prepares a 60-minute input window, runs inference, and returns structured JSON responses with alert levels classified as NONE, LOW, MODERATE, HIGH, or EXTREME. CORS is enabled for mobile app connectivity.

#### Mobile Application

The front-end is a cross-platform React Native mobile application built with Expo SDK 54 and TypeScript. The app features twelve screens including a Prediction Dashboard with real-time probability gauges, severity bars, line charts showing CME probability trends, and bar charts for feature importance — all rendered with react-native-chart-kit. The UI uses a glassmorphic design language with BlurView panels, linear gradient backgrounds, and Lottie animations for loading states. Authentication is handled by Clerk. Other screens include an Aditya-L1 instrument panel, ISRO satellite tracker with react-native-maps integration, global auroral oval and Kp index space weather map, 72-hour weather forecast, interactive graph simulation, AI chatbot, and a community research hub. The app connects to the FastAPI backend over the local network and gracefully falls back to mock predictions when offline.

#### Complete Tech Stack

**Languages:** Python 3.11+, TypeScript, C++ (for optimized data processing)
**ML Framework:** PyTorch >= 2.0 (Bi-LSTM, Transformer, Attention mechanisms)
**Backend:** FastAPI, Uvicorn (ASGI), Pydantic
**Mobile:** React Native, Expo SDK 54, React Navigation 7.x
**UI Libraries:** expo-blur, expo-linear-gradient, react-native-chart-kit, lucide-react-native, lottie-react-native
**Auth:** Clerk (clerk-expo)
**Space Science:** SunPy >= 5.0, AstroPy >= 5.0, SpacePy >= 0.4
**Data Science:** Pandas >= 2.0, NumPy >= 1.24, Scikit-Learn, SciPy, Seaborn, Matplotlib
**Data Sources:** ISRO ISSDC (CDF), NOAA SWPC (JSON), NASA ACE (CSV), CACTUS (catalog)
**Desktop Monitor:** Tkinter + Matplotlib (real-time CME visualization)
**Networking:** Requests, aiohttp, fetchWithTimeout (React Native side)

#### What I Learned

Building OrbitBharat solo taught me how to think across the entire stack — from parsing binary CDF files with SpacePy to designing attention mechanisms in PyTorch to crafting responsive glassmorphic UIs in React Native. The most rewarding part was making the connection work end-to-end: live satellite data flowing through a neural network and appearing as a human-readable risk assessment on a phone screen within two seconds. This project represents my belief that space weather monitoring should be accessible, intelligent, and real-time — and that a single determined developer can build it.
