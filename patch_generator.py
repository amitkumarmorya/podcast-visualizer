with open("execution/image_generator.py", "r") as f:
    content = f.read()

content = content.replace("response = urllib.request.urlopen(req)", "response = urllib.request.urlopen(req, timeout=10)")

with open("execution/image_generator.py", "w") as f:
    f.write(content)
print("Patched!")
