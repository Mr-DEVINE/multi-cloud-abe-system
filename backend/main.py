from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Initialize FastAPI App
app = FastAPI(
    title="Multi-Cloud ABE System API",
    description="Backend for Secure Data Sharing using CP-ABE in Multi-Cloud Environments",
    version="1.0.0"
)

# Setup CORS so your React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change "*" to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for Data Validation ---
class UserAttributes(BaseModel):
    user_id: str
    attributes: list[str]

class AccessPolicy(BaseModel):
    policy_string: str

# --- API Endpoints ---

@app.get("/")
async def health_check():
    return {"status": "success", "message": "Multi-Cloud ABE Backend is running smoothly."}

@app.post("/setup-kgc")
async def setup_kgc():
    """Initializes the Key Generation Center (Master Key & Public Key)"""
    # TODO: Integrate Charm-Crypto Setup here
    return {"status": "success", "message": "KGC setup complete. Public and Master keys generated."}

@app.post("/generate-key")
async def generate_user_key(user: UserAttributes):
    """Generates a mathematical Private Key based on user attributes"""
    # TODO: Integrate Charm-Crypto KeyGen here
    return {
        "status": "success", 
        "user_id": user.user_id,
        "message": f"Private key generated for attributes: {user.attributes}"
    }

@app.post("/encrypt-and-upload")
async def encrypt_and_upload(
    file: UploadFile = File(...), 
    policy: str = Form(...)
):
    """Encrypts file with CP-ABE and splits across Multi-Cloud"""
    # 1. Read the file
    file_bytes = await file.read()
    
    # TODO: 2. Encrypt with ABE using the 'policy'
    # TODO: 3. Split the ciphertext into 3 parts
    # TODO: 4. Upload to AWS, Azure, GCP
    
    return {
        "status": "success",
        "filename": file.filename,
        "policy": policy,
        "message": "File encrypted and distributed to multi-cloud successfully."
    }

@app.post("/download-and-decrypt")
async def download_and_decrypt(file_id: str, user_id: str):
    """Fetches chunks from clouds, reconstructs, and attempts decryption"""
    # TODO: 1. Fetch parts from AWS, Azure, GCP
    # TODO: 2. Reconstruct ciphertext
    # TODO: 3. Attempt decryption using user_id's private key
    
    return {"status": "pending", "message": "Decryption logic to be implemented."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)