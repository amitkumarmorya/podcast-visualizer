from google import genai
from google.genai import types

def extract_colors_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Uses Gemini Vision to extract the primary 2-3 hex colors from an uploaded brand logo.
    """
    client = genai.Client()
    
    prompt = "Analyze this logo image and extract the 2-3 most prominent brand hex colors globally. Return ONLY a comma-separated list of the hex codes, e.g., #FFFFFF, #121212. Provide no other text or explanation."
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt
        ],
        config=types.GenerateContentConfig(
            temperature=0.1
        )
    )
    return response.text.strip()
