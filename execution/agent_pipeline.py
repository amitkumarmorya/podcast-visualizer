import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt

load_dotenv()

# We expect GEMINI_API_KEY in the environment
client = genai.Client()

def _read_directive(filename: str) -> str:
    path = Path("directives") / filename
    if not path.exists():
        raise FileNotFoundError(f"Directive {filename} not found.")
    with open(path, "r") as f:
        return f.read()

@retry(wait=wait_exponential(multiplier=2, min=5, max=60), stop=stop_after_attempt(6))
def run_agent_a(script_text: str, num_outputs: int = 5) -> str:
    """Agent A: The Analyst. Identifies top 5-8 segments."""
    directive = _read_directive("agent_a_analyst.md")
    directive = directive.replace("{NUM_OUTPUTS}", str(num_outputs))
    
    prompt = f"{directive}\n\nInputs:\n- script_text: {script_text}\n\nOutput JSON strictly:"
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.7
        )
    )
    return response.text

@retry(wait=wait_exponential(multiplier=2, min=5, max=60), stop=stop_after_attempt(6))
def run_agent_b(segment_json_str: str, design_style: str = "3D Minimalist") -> str:
    """Agent B: The Visual Designer."""
    directive = _read_directive("agent_b_visual_designer.md")
    directive = directive.replace("{DESIGN_STYLE}", design_style)
    
    prompt = f"{directive}\n\nInputs:\n- segment: {segment_json_str}\n\nOutput JSON strictly:"
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.7
        )
    )
    return response.text

@retry(wait=wait_exponential(multiplier=2, min=5, max=60), stop=stop_after_attempt(6))
def run_agent_c(segment_json_str: str, brand_colors: str, feedback: str = "", design_style: str = "3D Minimalist") -> str:
    """Agent C: The Creative Director."""
    directive = _read_directive("agent_c_creative_director.md")
    directive = directive.replace("{DESIGN_STYLE}", design_style)
    
    prompt = f"{directive}\n\nInputs:\n- concept: {segment_json_str}\n- brand_colors: {brand_colors}\n- additional_context: {feedback}\n\nOutput JSON strictly:"
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.5
        )
    )
    return response.text

def process_podcast(script_text: str, brand_colors: str, num_outputs: int = 5, design_style: str = "3D Minimalist") -> list:
    """End-to-end pipeline: Analyst -> Visual Designer -> Creative Director"""
    print("Running Agent A...")
    analyst_result_str = run_agent_a(script_text, num_outputs)
    analyst_data = json.loads(analyst_result_str)
    
    segments = analyst_data.get("segments", [])
    
    results = []
    
    # Process each segment
    for seg in segments:
        print(f"Running Agent B for segment {seg.get('id')}...")
        designer_result_str = run_agent_b(json.dumps(seg), design_style)
        designer_data = json.loads(designer_result_str)
        
        print(f"Running Agent C for segment {seg.get('id')}...")
        director_result_str = run_agent_c(json.dumps(designer_data), brand_colors, feedback="", design_style=design_style)
        director_data = json.loads(director_result_str)
        
        results.append({
            "segment": seg,
            "concept": designer_data,
            "review": director_data
        })
        time.sleep(2)

    return results
