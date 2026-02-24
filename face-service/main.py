"""
Face Verification Service - Lightweight using face_recognition (dlib-based)
Memory footprint: ~50MB (no large model downloads needed)
"""

import os
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import face_recognition
import tempfile

# Initialize FastAPI
app = FastAPI(title="Face Verification Service v4.0", version="4.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _save_upload(upload_file: UploadFile) -> str:
  """Save uploaded file to temporary location"""
  with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
    tmp.write(upload_file.file.read())
    return tmp.name

@app.get("/")
async def root():
  """Health check endpoint"""
  return {
    "status": "running",
    "service": "face-verification",
    "model": "dlib-ResNet (face_recognition)",
    "version": "4.0",
    "memory_optimized": True,
    "embedding_size": 128
  }

@app.get("/health")
async def health():
  """Detailed health check"""
  return {
    "status": "healthy",
    "service": "face-verification",
    "ready": True,
    "memory_optimized": True,
    "embedding_size": 128
  }

@app.post("/get-embedding")
async def get_embedding(image: UploadFile = File(...)):
  """Extract face embedding from image using dlib ResNet"""
  temp_path = None
  try:
    temp_path = _save_upload(image)
    
    # Load image
    image_data = face_recognition.load_image_file(temp_path)
    
    # Get face encodings (embeddings)
    encodings = face_recognition.face_encodings(image_data, num_jitters=1)
    
    if not encodings:
      raise ValueError("No face detected in image")
    
    # Get largest face (first one detected)
    embedding = encodings[0]
    
    # Convert to list for JSON serialization
    embedding_list = embedding.tolist()
    
    return {
      "success": True,
      "embedding": embedding_list,
      "model": "dlib-ResNet",
      "embedding_size": len(embedding_list),
      "face_detected": True
    }
    
  except ValueError as ve:
    raise HTTPException(status_code=400, detail=f"Face detection failed: {str(ve)}")
  except Exception as exc:
    print(f"❌ Embedding extraction error: {exc}")
    raise HTTPException(status_code=500, detail=f"Embedding extraction failed: {str(exc)}")
  finally:
    if temp_path and os.path.exists(temp_path):
      os.unlink(temp_path)

@app.post("/compare-embeddings")
async def compare_embeddings(
  embA: list = Body(...),
  embB: list = Body(...)
):
  """Compare two embeddings using Euclidean distance - instant operation"""
  try:
    # Convert to numpy arrays
    arr_a = np.array(embA, dtype=np.float64)
    arr_b = np.array(embB, dtype=np.float64)
    
    # Compute Euclidean distance
    distance = float(np.linalg.norm(arr_a - arr_b))
    
    # dlib ResNet threshold: < 0.6 = same person (99.5% confidence)
    threshold = 0.6
    is_verified = distance < threshold
    confidence = max(0.0, 1.0 - (distance / 2.0))  # Normalize to 0-1

    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "dlib-ResNet"
    }
  except Exception as exc:
    print(f"❌ Comparison error: {exc}")
    raise HTTPException(status_code=500, detail=f"Comparison failed: {str(exc)}")

@app.post("/verify-face")
async def verify_face(
  imageA: UploadFile = File(...),
  imageB: UploadFile = File(...)
):
  """Compare two images directly using dlib ResNet embeddings"""
  temp_a = None
  temp_b = None

  try:
    temp_a = _save_upload(imageA)
    temp_b = _save_upload(imageB)
    
    # Load and encode both images
    img_a = face_recognition.load_image_file(temp_a)
    img_b = face_recognition.load_image_file(temp_b)
    
    # Get encodings
    encodings_a = face_recognition.face_encodings(img_a, num_jitters=1)
    encodings_b = face_recognition.face_encodings(img_b, num_jitters=1)
    
    if not encodings_a or not encodings_b:
      raise ValueError("Face not detected in one or both images")
    
    # Get first face from each image
    emb_a = encodings_a[0]
    emb_b = encodings_b[0]
    
    # Compare using Euclidean distance
    distance = float(np.linalg.norm(emb_a - emb_b))
    threshold = 0.6
    is_verified = distance < threshold
    confidence = max(0.0, 1.0 - (distance / 2.0))
    
    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "dlib-ResNet"
    }
    
  except ValueError as ve:
    raise HTTPException(status_code=400, detail=f"Face detection failed: {str(ve)}")
  except Exception as exc:
    print(f"❌ Verification error: {exc}")
    raise HTTPException(status_code=500, detail=f"Verification failed: {str(exc)}")
  finally:
    if temp_a and os.path.exists(temp_a):
      os.unlink(temp_a)
    if temp_b and os.path.exists(temp_b):
      os.unlink(temp_b)

if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=5001)
