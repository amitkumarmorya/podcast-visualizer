# Google Drive Image Upload Strategy

## Objective
This directive outlines the process for uploading locally generated or Canvas-rendered images directly to a Google Drive folder via the Google Drive V3 API.

## Technical Requirements
- **Location:** `execution/google_drive_uploader.py`
- **Dependencies:** `google-api-python-client`, `google-auth-httplib2`, `google-auth-oauthlib`
- **Authentication:** OAuth 2.0 flow using a `credentials.json` file.

## Execution Flow

### 1. Authentication (`authenticate_google_drive()`)
- Look for `token.json`. If it exists, use it.
- If it doesn't exist or is expired, trigger the local web server flow using `InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)`.
- Save the resulting credentials to `token.json` for future headless runs.
- **Scopes Required:** `https://www.googleapis.com/auth/drive.file` (limits access only to files created by the app).

### 2. Upload Logic (`upload_image_to_drive(filename, mime_type, byte_data)`)
- Initialize the Google Drive service object (`build('drive', 'v3', credentials=creds)`).
- Create a `MediaIoBaseUpload` object wrapping the raw byte data.
- Construct the file metadata (name and mimeType).
- Use `service.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()` to upload the image.
- Return the `webViewLink`.

### 3. API Integration
- The FastAPI server in `main.py` should expose a specific POST endpoint (e.g., `/api/save-to-drive`).
- The frontend Next.js app will send the raw base64 Data URL (e.g., `data:image/png;base64,...`) to this endpoint.
- The FastAPI route decodes the base64 string into bytes using `base64.b64decode()` before passing it to `upload_image_to_drive()`.

## Rules & Constraints
- Do **NOT** assume the user has set up `credentials.json` yet. The code must handle the `FileNotFoundError` gracefully and return an actionable error message telling the user to set up Google Cloud OAuth.
- The Python script must be completely deterministic and resilient to missing config files.
- Limit scopes as tightly as possible (`drive.file`) to avoid scaring users with full Drive access permissions.
- Ensure the FastAPI server correctly handles CORS for the exact origin if making cross-origin requests from the Next.js dev server.
