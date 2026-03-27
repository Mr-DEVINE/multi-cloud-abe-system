from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from crypto import ABESimulator  # Importing our ABE logic

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

# --- Mock Database ---
# We use this dictionary to simulate MongoDB until we connect it.
mock_database = {
    "files": {},
    "users": {
        # Pre-loading some users for testing purposes
        "user_alice": ["hr", "manager"],
        "user_bob": ["it", "intern"],
        "user_charlie": ["director", "finance"]
    }
}

# --- API Endpoints ---

@app.get("/")
async def health_check():
    return {"status": "success", "message": "Multi-Cloud ABE Backend is running smoothly."}

@app.post("/setup-kgc")
async def setup_kgc():
    """Initializes the Key Generation Center"""
    return {"status": "success", "message": "KGC setup complete. System is ready."}

@app.post("/generate-key")
async def generate_user_key(user: UserAttributes):
    """Registers a user and assigns them attributes"""
    # Convert attributes to lowercase for consistency
    lower_attrs = [attr.lower() for attr in user.attributes]
    mock_database["users"][user.user_id] = lower_attrs
    
    return {
        "status": "success", 
        "user_id": user.user_id,
        "message": f"Attributes registered successfully: {lower_attrs}"
    }

@app.post("/encrypt-and-upload")
async def encrypt_and_upload(
    file: UploadFile = File(...), 
    policy: str = Form(...)
):
    """Encrypts file with ABE Simulation and stores it"""
    try:
        # 1. Read the uploaded file
        file_bytes = await file.read()
        
        # 2. Generate a key and encrypt (Simulating ABE Encryption)
        file_key = ABESimulator.generate_master_key()
        encrypted_data = ABESimulator.encrypt_file(file_bytes, file_key)
        
        # 3. Save metadata and encrypted file to our mock database
        file_id = f"file_{len(mock_database['files']) + 1}"
        mock_database["files"][file_id] = {
            "filename": file.filename,
            "policy": policy,
            "key": file_key, # In strict ABE, this key is embedded mathematically
            "encrypted_content": encrypted_data # We will split this for multi-cloud later
        }
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "policy_applied": policy,
            "message": "File encrypted securely."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.post("/download-and-decrypt")
async def download_and_decrypt(file_id: str, user_id: str):
    """Evaluates the access policy and decrypts the file if allowed"""
    
    # Check if the requested file and user exist in our system
    if file_id not in mock_database["files"]:
        raise HTTPException(status_code=404, detail="File not found")
    if user_id not in mock_database["users"]:
        raise HTTPException(status_code=404, detail="User not found")
        
    file_record = mock_database["files"][file_id]
    user_attributes = mock_database["users"][user_id]
    
    # 1. Evaluate the Policy (The core Attribute-Based logic)
    has_access = ABESimulator.evaluate_policy(file_record["policy"], user_attributes)
    
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied: User attributes {user_attributes} do not satisfy the policy '{file_record['policy']}'."
        )
        
    # 2. If access is granted, decrypt the file
    try:
        decrypted_data = ABESimulator.decrypt_file(file_record["encrypted_content"], file_record["key"])
        
        return {
            "status": "success",
            "message": "Access Granted. File Decrypted.",
            "filename": file_record["filename"],
            "original_size_bytes": len(decrypted_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)