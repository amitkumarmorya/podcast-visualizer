import requests

url = "http://localhost:8000/api/save-to-drive"
payload = {"image_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY3jP4PgfAAWpA6FItA9VAAAAAElFTkSuQmCC"}

response = requests.post(url, data=payload)
print(response.status_code)
print(response.json())
