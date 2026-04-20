#!/bin/bash

# Stage all files
git add .

# Prompt for a commit message, or default to timestamp if empty
read -p "Enter commit message (or press enter for default timestamp): " message

if [ -z "$message" ]; then
    current_time=$(date "+%Y-%m-%d %H:%M:%S")
    message="Auto-sync: $current_time"
fi

git commit -m "$message"

# Push to GitHub
git push origin main

echo "✅ Backup to GitHub complete!"
