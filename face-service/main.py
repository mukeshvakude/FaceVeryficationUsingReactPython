import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace

app = FastAPI()

# Enable CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/verify-face")
async def verify_face(imageA: UploadFile = File(...), imageB: UploadFile = File(...)):
  temp_a = None
  temp_b = None

  try:
    temp_a = _save_upload(imageA)
    temp_b = _save_upload(imageB)

    # Use cosine distance model with stricter threshold for better security
    result = DeepFace.verify(
      img1_path=temp_a, 
      img2_path=temp_b, 
      model_name="Facenet512",
      distance_metric="cosine",
      enforce_detection=True
    )
    distance = float(result.get("distance", 0.0))
    threshold = float(result.get("threshold", 0.4))  # Default threshold
    
    # For Facenet512 with cosine, distance < 0.3 is same person, > 0.4 is different
    # We use 0.35 as a stricter threshold for security
    strict_threshold = 0.35
    is_verified = distance < strict_threshold
    
    confidence = max(0.0, 1.0 - distance)

    return {
      "verified": is_verified,
      "distance": round(distance, 4),
      "threshold": strict_threshold,
      "model_threshold": threshold,
      "confidence": round(confidence, 4)
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
