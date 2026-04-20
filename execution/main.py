from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import json
from .agent_pipeline import process_podcast, run_agent_c
from .image_generator import generate_image
from .color_extractor import extract_colors_from_image
from .google_drive_uploader import upload_image_to_drive
import base64
from pydantic import BaseModel

class DriveUploadRequest(BaseModel):
    image_data_url: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/extract-colors")
def api_extract_colors(logo_file: UploadFile = File(...)):
    """
    Accepts a logo upload and extracts the primary hex colors using Gemini Vision.
    """
    content = logo_file.file.read()
    try:
        colors = extract_colors_from_image(content, mime_type=logo_file.content_type or "image/jpeg")
        return {"status": "success", "colors": colors}
    except Exception as e:
        return {"status": "error", "message": str(e)}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/process-script")
def api_process_script(
    script_file: UploadFile = File(...),
    brand_colors: str = Form(...),
    num_outputs: int = Form(5),
    design_style: str = Form("3D Minimalist")
):
    """
    Ingests the podcast script and brand assets, runs Agent A->B->C 
    and returns the visual concepts for review.
    """
    content = script_file.file.read()
    text = content.decode("utf-8")
    
    results = process_podcast(text, brand_colors, num_outputs, design_style)
    return {"status": "success", "results": results}

out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "out")
if os.path.exists(out_dir):
    app.mount("/", StaticFiles(directory=out_dir, html=True), name="static")

@app.post("/api/iterate-concept")
def api_iterate_concept(
    segment: str = Form(...),
    feedback: str = Form(...),
    brand_colors: str = Form(...),
    design_style: str = Form("3D Minimalist")
):
    """
    Iterates on a single concept utilizing Agent C (which can refine prompts).
    """
    director_result_str = run_agent_c(segment, brand_colors, feedback, design_style)
    return {"status": "success", "refined_concept": json.loads(director_result_str)}

@app.post("/api/generate-images")
def api_generate_images(payload: dict):
    """
    Takes approved concepts and generates images via Nanobanana API.
    """
    prompts = payload.get("prompts", [])
    urls = []
    
    for prompt in prompts:
        url = generate_image(prompt)
        urls.append(url)
        
    return {"status": "success", "image_urls": urls}

@app.post("/api/save-to-drive")
def api_save_to_drive(
    request: DriveUploadRequest
):
    """
    Receives a base64 encoded data URL (e.g. data:image/png;base64,iVBORw0KGgo...)
    Decodes the byte data, and pushes it to Google Drive.
    """
    try:
        # Strip the data:image/png;base64, prefix
        header, encoded = request.image_data_url.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
        
        byte_data = base64.b64decode(encoded)
        
        import time
        filename = f"podcast_visualizer_{int(time.time())}.png"
        
        drive_link = upload_image_to_drive(filename, mime_type, byte_data)
        
        return {
            "status": "success", 
            "link": drive_link,
            "message": "Asset successfully uploaded to Google Drive."
        }
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"Error saving to drive: {error_msg}")
        return {"status": "error", "message": error_msg}
