import os
import tempfile
import json
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace

app = FastAPI()

# Cache for loaded model to avoid reloading
_model_cache = {}


def _get_model(model_name="Facenet"):
  """Get model from cache or load it"""
  if model_name not in _model_cache:
    try:
      _model_cache[model_name] = DeepFace.build_model(model_name)
      print(f"✅ Loaded {model_name} model")
    except Exception as e:
      print(f"❌ Failed to load {model_name}: {e}")
      raise
  return _model_cache[model_name]


# Enable CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
  """Health check endpoint"""
  return {
    "status": "running",
    "service": "face-verification",
    "model": "Facenet",
    "version": "2.0"
  }


@app.get("/health")
async def health():
  """Detailed health check"""
  return {
    "status": "healthy",
    "service": "face-verification",
    "ready": True,
    "model_cached": "Facenet" in _model_cache
  }


def _save_upload(upload: UploadFile):
  if not upload.content_type or not upload.content_type.startswith("image/"):
    raise HTTPException(status_code=400, detail="Invalid image type")

  suffix = os.path.splitext(upload.filename or "image.jpg")[1]
  temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
  content = upload.file.read()
  temp.write(content)
  temp.flush()
  temp.close()
  return temp.name


@app.post("/get-embedding")
async def get_embedding(image: UploadFile = File(...)):
  """Extract face embedding from image - fast, no comparison needed"""
  temp_path = None

  try:
    temp_path = _save_upload(image)

    # Ensure model is cached before embedding extraction
    _get_model("Facenet")

    # Use represent() to get embedding vector (no model building - uses cache)
    embeddings = DeepFace.represent(
      img_path=temp_path,
      model_name="Facenet",
      enforce_detection=True
    )
    
    # DeepFace.represent returns list of dicts, get first result
    embedding = embeddings[0]["embedding"]
    
    # Convert numpy array to list for JSON serialization
    embedding_list = embedding if isinstance(embedding, list) else embedding.tolist()

    return {
      "success": True,
      "embedding": embedding_list,
      "model": "Facenet",
      "embedding_size": len(embedding_list)
    }
  except ValueError as ve:
    # Face not detected
    raise HTTPException(status_code=400, detail=f"Face detection failed: {str(ve)}")
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Embedding extraction failed: {str(exc)}")
  finally:
    if temp_path and os.path.exists(temp_path):
      os.unlink(temp_path)


@app.post("/compare-embeddings")
async def compare_embeddings(
  embA: list = Body(...),
  embB: list = Body(...)
):
  """Compare two embeddings using cosine distance - instant operation"""
  try:
    # Convert to numpy arrays
    arr_a = np.array(embA, dtype=np.float32)
    arr_b = np.array(embB, dtype=np.float32)

    # Compute cosine distance
    from scipy.spatial.distance import cosine
    distance = float(cosine(arr_a, arr_b))
    
    # Facenet threshold: < 0.40 = same person, > 0.50 = different
    threshold = 0.40
    is_verified = distance < threshold
    confidence = max(0.0, 1.0 - distance)

    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "Facenet"
    }
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Comparison failed: {str(exc)}")


@app.post("/verify-face")
async def verify_face(imageA: UploadFile = File(...), imageB: UploadFile = File(...)):
  """Legacy endpoint: Compare two images directly (slow, for backward compatibility)"""
  temp_a = None
  temp_b = None

  try:
    temp_a = _save_upload(imageA)
    temp_b = _save_upload(imageB)

    # Use Facenet model - balanced size and accuracy (~100MB)
    result = DeepFace.verify(
      img1_path=temp_a, 
      img2_path=temp_b, 
      model_name="Facenet",
      distance_metric="cosine",
      enforce_detection=True
    )
    distance = float(result.get("distance", 0.0))
    threshold = float(result.get("threshold", 0.40))  # Facenet default threshold
    
    # For Facenet with cosine, distance < 0.40 is same person, > 0.50 is different
    strict_threshold = 0.40
    is_verified = distance < strict_threshold
    
    confidence = max(0.0, 1.0 - distance)

    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": strict_threshold,
      "model_threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "Facenet"
    }
  except ValueError as ve:
    # Face not detected
    raise HTTPException(status_code=400, detail=f"Face detection failed: {str(ve)}")
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Verification failed: {str(exc)}")
  finally:
    if temp_a and os.path.exists(temp_a):
      os.unlink(temp_a)
    if temp_b and os.path.exists(temp_b):
      os.unlink(temp_b)
