import os
import base64
from google import genai
from dotenv import load_dotenv

load_dotenv()

# We expect GEMINI_API_KEY in the environment
# Nano Banana (Google's image generation model, Imagen 3) is accessed via the Gemini API
client = genai.Client()

def generate_image(prompt: str) -> str:
    """
    Calls the Gemini API to generate an image based on the Refined Prompt.
    Returns a base64 encoded data URI of the generated image.
    """
    try:
        result = client.models.generate_images(
            model='imagen-4.0-fast-generate-001',
            prompt=prompt,
            config=dict(
                number_of_images=1,
                output_mime_type="image/jpeg",
                aspect_ratio="1:1"
            )
        )
        for generated_image in result.generated_images:
            b64 = base64.b64encode(generated_image.image.image_bytes).decode('utf-8')
            return f"data:image/jpeg;base64,{b64}"
            
    except Exception as e:
        print(f"Error generating image with Gemini API: {e}")
        
    print("Warning: Gemini Imagen requires a paid plan. Falling back to free Pollinations AI generation.")
    import urllib.parse
    import urllib.request
    
    encoded_prompt = urllib.parse.quote(prompt)
    fallback_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1000&height=1000&nologo=true"
    
    try:
        req = urllib.request.Request(fallback_url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        response = urllib.request.urlopen(req, timeout=10)
        image_bytes = response.read()
        b64 = base64.b64encode(image_bytes).decode('utf-8')
        return f"data:image/jpeg;base64,{b64}"
    except Exception as fallback_err:
        print(f"Fallback also failed: {fallback_err}")
        return fallback_url
