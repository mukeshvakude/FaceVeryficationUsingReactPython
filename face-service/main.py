"""
Face Verification Service - Ultra-lightweight using MediaPipe
Memory footprint: ~50MB (pure Python, no compilation needed)
Build time: <10s
"""

import os
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
import tempfile

# Initialize FastAPI
app = FastAPI(title="Face Verification Service v5.0", version="5.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(
    model_selection=1,  # 1 = full range
    min_detection_confidence=0.5
)

def _save_upload(upload_file: UploadFile) -> str:
  """Save uploaded file to temporary location"""
  with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
    tmp.write(upload_file.file.read())
    return tmp.name

def _extract_face_region(image):
  """Extract and normalize face region using MediaPipe detection"""
  h, w, _ = image.shape
  
  # Detect face
  results = face_detection.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
  
  if not results.detections:
    return None
  
  # Get first detection
  detection = results.detections[0]
  bbox = detection.location_data.relative_bounding_box
  
  # Convert to pixel coordinates
  x = int(bbox.xmin * w)
  y = int(bbox.ymin * h)
  width = int(bbox.width * w)
  height = int(bbox.height * h)
  
  # Add padding
  padding = int(0.1 * max(width, height))
  x = max(0, x - padding)
  y = max(0, y - padding)
  width = min(w - x, width + 2 * padding)
  height = min(h - y, height + 2 * padding)
  
  # Extract face region
  face_region = image[y:y+height, x:x+width]
  
  if face_region.size == 0:
    return None
  
  # Normalize to 256x256
  face_normalized = cv2.resize(face_region, (256, 256), interpolation=cv2.INTER_AREA)
  
  return face_normalized

def _face_region_to_embedding(face_region):
  """Convert face region to embedding using pixel features + histogram"""
  if face_region is None:
    raise ValueError("No face region")
  
  # Convert to grayscale
  gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
  
  # Resize to consistent size (64x64 for speed)
  resized = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
  
  # Apply histogram equalization for lighting normalization
  equalized = cv2.equalizeHist(resized)
  
  # Flatten pixels
  pixel_features = equalized.flatten().astype(np.float32)
  
  # Compute histogram features (16 bins)
  hist = cv2.calcHist([equalized], [0], None, [16], [0, 256])
  hist = hist.flatten().astype(np.float32)
  
  # Combine pixel features with histogram
  # Use a subset of pixels to reduce dimensionality (every 4th pixel)
  embedding = np.concatenate([
    pixel_features[::4],  # 1024 features (64x64/4)
    hist  # 16 histogram features
  ])
  
  # Normalize embedding
  embedding = embedding / (np.linalg.norm(embedding) + 1e-8)
  
  return embedding.tolist()

@app.get("/")
async def root():
  """Health check endpoint"""
  return {
    "status": "running",
    "service": "face-verification",
    "model": "MediaPipe Detection + Pixel Features",
    "version": "5.1",
    "memory_optimized": True,
    "embedding_size": 1040  # 1024 pixel features + 16 histogram
  }

@app.get("/health")
async def health():
  """Detailed health check"""
  return {
    "status": "healthy",
    "service": "face-verification",
    "ready": True,
    "memory_optimized": True,
    "embedding_size": 1040
  }

@app.post("/get-embedding")
async def get_embedding(image: UploadFile = File(...)):
  """Extract face embedding from image using MediaPipe Face Mesh"""
  temp_path = None
  try:
    temp_path = _save_upload(image)
    
    # Load image
    image_data = cv2.imread(temp_path)
    if image_data is None:
      raise ValueError("Invalid image format")
    
    # Extract face region
    face_region = _extract_face_region(image_data)
    if face_region is None:
      raise ValueError("No face detected in image")
    
    # Get embedding from landmarks
    embedding = _face_region_to_embedding(face_region)
    
    return {
      "success": True,
      "embedding": embedding,
      "model": "MediaPipe-PixelFeatures",
      "embedding_size": len(embedding),
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
  """Compare two embeddings using cosine distance"""
  try:
    # Convert to numpy arrays
    arr_a = np.array(embA, dtype=np.float32)
    arr_b = np.array(embB, dtype=np.float32)
    
    # Normalize
    arr_a = arr_a / (np.linalg.norm(arr_a) + 1e-8)
    arr_b = arr_b / (np.linalg.norm(arr_b) + 1e-8)
    
    # Compute cosine distance
    distance = float(1.0 - np.dot(arr_a, arr_b))
    
    # Threshold for pixel-based features: < 0.15 = same person (85%+ similarity)
    threshold = 0.15
    is_verified = distance < threshold
    confidence = max(0.0, 1.0 - distance)

    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "MediaPipe-PixelFeatures"
    }
  except Exception as exc:
    print(f"❌ Comparison error: {exc}")
    raise HTTPException(status_code=500, detail=f"Comparison failed: {str(exc)}")

@app.post("/verify-face")
async def verify_face(
  imageA: UploadFile = File(...),
  imageB: UploadFile = File(...)
):
  """Compare two images directly using MediaPipe Face Mesh"""
  temp_a = None
  temp_b = None

  try:
    temp_a = _save_upload(imageA)
    temp_b = _save_upload(imageB)
    
    # Load images
    img_a = cv2.imread(temp_a)
    img_b = cv2.imread(temp_b)
    
    if img_a is None or img_b is None:
      raise ValueError("Invalid image format")
    
    # Extract face regions
    face_a = _extract_face_region(img_a)
    face_b = _extract_face_region(img_b)
    
    if face_a is None or face_b is None:
      raise ValueError("Face not detected in one or both images")
    
    # Get embeddings
    emb_a = _face_region_to_embedding(face_a)
    emb_b = _face_region_to_embedding(face_b)
    
    # Convert to numpy for comparison
    arr_a = np.array(emb_a, dtype=np.float32)
    arr_b = np.array(emb_b, dtype=np.float32)
    
    # Normalize
    arr_a = arr_a / (np.linalg.norm(arr_a) + 1e-8)
    arr_b = arr_b / (np.linalg.norm(arr_b) + 1e-8)
    
    # Compare
    distance = float(1.0 - np.dot(arr_a, arr_b))
    threshold = 0.15
    is_verified = distance < threshold
    confidence = max(0.0, 1.0 - distance)
    
    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": threshold,
      "confidence": round(confidence, 4),
      "model": "MediaPipe-PixelFeatures"
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
