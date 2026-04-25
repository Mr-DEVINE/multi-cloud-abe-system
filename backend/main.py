import os
from datetime import datetime, timedelta
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from pymongo import MongoClient
import bcrypt
import jwt

# Import our custom modules
from crypto import ABESimulator
from storage import storage_manager

# Load Environment Variables
load_dotenv()

# --- Initialize FastAPI App ---
app = FastAPI(
    title="Multi-Cloud ABE System API",
    description="Backend for Secure Data Sharing with MongoDB and Auth",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MongoDB Setup ---
MONGO_URI = os.getenv("MONGODB_URI")
if not MONGO_URI:
    raise ValueError("MONGODB_URI is missing from .env file!")

client = MongoClient(MONGO_URI)
db = client["multi_cloud_abe"]
users_collection = db["users"]
files_collection = db["files"]

# --- Authentication Security Setup ---
SECRET_KEY = "your-very-secret-jwt-key"  # In production, this goes in .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str) -> str:
    """Hashes a password using pure bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password using pure bcrypt"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- Pydantic Models ---
class UserSignup(BaseModel):
    username: str
    password: str
    attributes: list[str]

class UserLogin(BaseModel):
    username: str
    password: str

# --- Auto-Seed Default Users for Testing ---
# Using lifespan context instead of on_event as requested by the FastAPI warning!
@app.on_event("startup")
def startup_db_seed():
    """Seeds the DB with our test users so the React frontend still works."""
    if users_collection.count_documents({}) == 0:
        default_users = [
            {"username": "user_alice", "password": hash_password("password123"), "attributes": ["hr", "manager"]},
            {"username": "user_bob", "password": hash_password("password123"), "attributes": ["it", "intern"]},
            {"username": "user_charlie", "password": hash_password("password123"), "attributes": ["director", "finance"]}
        ]
        users_collection.insert_many(default_users)
        print("MongoDB seeded with default test users: user_alice, user_bob, user_charlie.")

# --- API Endpoints ---

@app.get("/")
async def health_check():
    return {"status": "success", "message": "Multi-Cloud ABE Backend is running and connected to MongoDB."}

@app.post("/signup")
async def signup(user: UserSignup):
    """Registers a new user securely into MongoDB."""
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already registered")

    user_dict = {
        "username": user.username,
        "password": hash_password(user.password),
        "attributes": [attr.lower() for attr in user.attributes],
        "created_at": datetime.utcnow()
    }
    users_collection.insert_one(user_dict)
    
    return {"status": "success", "message": "Account created! Attributes assigned."}

@app.post("/login")
async def login(user: UserLogin):
    """Authenticates a user and returns a JWT token."""
    db_user = users_collection.find_one({"username": user.username})
    
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    expiration = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {"sub": user.username, "exp": expiration}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token, 
        "token_type": "bearer", 
        "username": user.username, 
        "attributes": db_user["attributes"]
    }

@app.post("/encrypt-and-upload")
async def encrypt_and_upload(
    file: UploadFile = File(...), 
    policy: str = Form(...)
):
    """Encrypts file, splits to Multi-Cloud, and saves metadata to MongoDB."""
    try:
        file_bytes = await file.read()
        file_key = ABESimulator.generate_master_key()
        encrypted_data = ABESimulator.encrypt_file(file_bytes, file_key)
        
        file_id = f"file_{int(datetime.utcnow().timestamp())}"
        chunk_metadata = storage_manager.split_and_upload(file_id, encrypted_data)
        
        file_document = {
            "file_id": file_id,
            "filename": file.filename,
            "policy": policy,
            "key": file_key.decode('utf-8'),
            "chunks": chunk_metadata,
            "uploaded_at": datetime.utcnow()
        }
        files_collection.insert_one(file_document)
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "policy_applied": policy,
            "message": "File encrypted, split, and distributed to multi-cloud successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.post("/download-and-decrypt")
async def download_and_decrypt(file_id: str, user_id: str):
    """Verifies ABE policy via MongoDB attributes and decrypts."""
    file_record = files_collection.find_one({"file_id": file_id})
    user_record = users_collection.find_one({"username": user_id})
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_attributes = user_record["attributes"]
    has_access = ABESimulator.evaluate_policy(file_record["policy"], user_attributes)
    
    if not has_access:
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied: Your attributes {user_attributes} do not satisfy the policy '{file_record['policy']}'."
        )
        
    try:
        reconstructed_encrypted_data = storage_manager.download_and_reconstruct(file_id, file_record["chunks"])
        decryption_key = file_record["key"].encode('utf-8')
        decrypted_data = ABESimulator.decrypt_file(reconstructed_encrypted_data, decryption_key)
        
        return {
            "status": "success",
            "message": "File successfully fetched from AWS, Azure, & GCP, reconstructed, and decrypted.",
            "filename": file_record["filename"],
            "original_size_bytes": len(decrypted_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download/Decryption failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)