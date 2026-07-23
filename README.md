# Self-Service Analytics & ML Platform

A no-code AutoML platform. Upload a CSV, clean your data, explore it, train a model, and get predictions — all through an interactive UI.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend (Vite)               │
│  Upload → Clean → EDA → AutoML Train → Results      │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (axios)
┌────────────────────▼────────────────────────────────┐
│               FastAPI Backend (Python)               │
│  /upload  /eda  /clean  /train  /results  /predict  │
└──────┬──────────────┬──────────────────┬────────────┘
       │              │                  │
  pandas/numpy   scikit-learn       Local Disk
  (EDA/Clean)    + XGBoost          (or Blob)
                 (AutoML)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Recharts |
| Backend | Python 3.12, FastAPI, Pydantic v2 |
| ML | scikit-learn, XGBoost |
| Data | pandas, numpy |
| Container | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | Render (backend) + Vercel (frontend) |

## Local Development

### Prerequisites
- Python 3.12+
- Node.js 20+

### 1. Clone and set up backend

```bash
git clone <your-repo-url>
cd "Self Service Project"

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate        # macOS/Linux

# Install dependencies
cd backend
pip install -r requirements.txt

# Start backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### 3. Run with Docker Compose (single command)

```bash
# Copy env file
cp .env.example .env

# Start everything
docker compose up --build
```

Frontend → http://localhost:3000  
Backend → http://localhost:8000  
Health check → http://localhost:8000/health

## Workflow

```
1. 📂 Upload    → Drop a CSV file (max 50 MB)
2. 🧹 Clean     → Handle missing values, encode categoricals, remove outliers
3. 🔍 EDA       → Column types, null counts, numeric stats, outlier flags
4. 🤖 Train     → Select target column, AutoML trains 3 models, picks best
5. 📊 Results   → Metrics, feature importance chart, sample predictions, live predict
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Upload CSV file → returns `dataset_id` |
| GET | `/datasets` | List all uploaded datasets |
| GET | `/datasets/{id}` | Get dataset metadata |
| GET | `/eda/{dataset_id}` | EDA summary (stats, nulls, outliers) |
| POST | `/clean/{dataset_id}` | Clean dataset with configurable options |
| POST | `/train` | Start AutoML training → returns `job_id` |
| GET | `/train/{job_id}` | Poll training job status |
| GET | `/results/{job_id}` | Get metrics, feature importance, predictions |
| POST | `/predict` | Run live prediction with trained model |
| GET | `/health` | Health check |

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Default | Description |
|---|---|---|
| `DATA_STORAGE_DIR` | `/app/storage` | Where uploads and models are stored |
| `MAX_UPLOAD_MB` | `50` | Max CSV upload size in MB |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `STORAGE_BACKEND` | `local` | `local` or `azure` |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend URL for frontend |

## Deployment

### Backend → Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. Set `CORS_ORIGINS` to your Vercel URL in Render dashboard environment variables
6. Copy the Render public URL (e.g. `https://self-service-backend.onrender.com`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   - `VITE_API_BASE_URL` = your Render backend URL
5. Click **Deploy**

### CI/CD (GitHub Actions)

Add these secrets to your GitHub repo → Settings → Secrets:

| Secret | Where to get it |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Access Tokens |
| `RENDER_BACKEND_DEPLOY_HOOK` | Render dashboard → Service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Project Settings → General |
| `VERCEL_PROJECT_ID` | Vercel → Project Settings → General |
| `VITE_API_BASE_URL` | Your Render backend public URL |

Once secrets are set, every push to `main` runs:
```
lint → pytest → docker build → push → deploy to Render + Vercel
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── config.py        # Environment-based config
│   │   ├── schemas.py       # Pydantic models
│   │   ├── routers/         # datasets, eda, training, predictions
│   │   ├── services/        # data_service, ml_service, storage
│   │   └── utils/           # validation
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts    # Typed API wrappers
│   │   ├── components/      # UploadZone, CleanPanel, EdaPanel, TrainPanel, ResultsView
│   │   ├── hooks/           # useTrainingJob (polling)
│   │   └── types/           # Shared TypeScript types
│   ├── vercel.json
│   └── vite.config.js
├── .github/workflows/ci-cd.yml
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── render.yaml
└── .env.example
```
