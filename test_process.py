import requests

url = "http://localhost:8000/api/process-script"
files = {'script_file': ('script.txt', b'This is a test podcast script. We discuss AI and future of tech.', 'text/plain')}
data = {
    'brand_colors': '#121212, #FFFFFF',
    'num_outputs': '1',
    'design_style': '3D Minimalist'
}

try:
    response = requests.post(url, files=files, data=data)
    print("STATUS:", response.status_code)
    try:
        print("JSON:", response.json())
    except Exception as e:
        print("TEXT:", response.text)
except Exception as e:
    print("FETCH ERROR:", e)
