import os
from datetime import datetime, timedelta
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from pymongo import MongoClient
import bcrypt
import jwt
import dns.resolver  # <--- ADDED: Import for DNS fixing

# Import our custom modules
from crypto import ABESimulator
from storage import storage_manager

# Load Environment Variables
load_dotenv()

# <--- ADDED: Force Google's public DNS to fix macOS "no nameservers" error --->
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']

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
    allow_headers=["*", "Content-Disposition"],
    expose_headers=["Content-Disposition"] # Essential for frontend to read the filename
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
SECRET_KEY = "your-very-secret-jwt-key"  
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- Pydantic Models ---
class UserSignup(BaseModel):
    username: str
    password: str
    attributes: list[str]

class UserLogin(BaseModel):
    username: str
    password: str

class AdminUpdateUser(BaseModel):
    attributes: list[str]
    is_approved: bool

# --- JWT Dependency ---
def get_current_username(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Auto-Seed Master Admin ---
@app.on_event("startup")
def startup_db_seed():
    """Ensures a Master Admin exists in the database."""
    if not users_collection.find_one({"username": "admin"}):
        admin_user = {
            "username": "admin",
            "password": hash_password("admin123"),
            "attributes": ["admin"],
            "is_admin": True,
            "is_approved": True,
            "created_at": datetime.utcnow()
        }
        users_collection.insert_one(admin_user)
        print("✅ Master Admin account created! (Username: admin | Password: admin123)")

# --- API Endpoints ---

@app.post("/signup")
async def signup(user: UserSignup):
    """Registers a new user (Pending Admin Approval)."""
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already registered")

    user_dict = {
        "username": user.username,
        "password": hash_password(user.password),
        "attributes": [attr.lower() for attr in user.attributes],
        "created_at": datetime.utcnow(),
        "is_admin": False,
        "is_approved": False  # MUST BE APPROVED BY ADMIN
    }
    users_collection.insert_one(user_dict)
    
    return {"status": "success", "message": "Account created! Pending Admin approval."}

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
        "attributes": db_user.get("attributes", []),
        "is_admin": db_user.get("is_admin", False),
        "is_approved": db_user.get("is_approved", True) # Added this line!
    }

# --- ADMIN ENDPOINTS ---

@app.get("/admin/users")
async def get_all_users(username: str = Depends(get_current_username)):
    """Admin only: Fetches all users in the system."""
    admin_user = users_collection.find_one({"username": username})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied. Admin rights required.")
    
    users = []
    for u in users_collection.find({}, {"_id": 0, "password": 0}):
        users.append({
            "username": u["username"],
            "attributes": u.get("attributes", []),
            "is_admin": u.get("is_admin", False),
            "is_approved": u.get("is_approved", True), # default true for old accounts
            "created_at": str(u.get("created_at", ""))
        })
    return {"status": "success", "users": users}

@app.put("/admin/users/{target_username}")
async def update_user(target_username: str, update_data: AdminUpdateUser, username: str = Depends(get_current_username)):
    """Admin only: Approves users and updates their attributes."""
    admin_user = users_collection.find_one({"username": username})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
        
    users_collection.update_one(
        {"username": target_username},
        {"$set": {
            "attributes": [attr.lower() for attr in update_data.attributes],
            "is_approved": update_data.is_approved
        }}
    )
    return {"status": "success", "message": f"User '{target_username}' successfully updated."}

# --- EXISTING ABE ENDPOINTS ---

@app.post("/encrypt-and-upload")
async def encrypt_and_upload(file: UploadFile = File(...), policy: str = Form(...)):
    try:
        file_bytes = await file.read()
        file_key = ABESimulator.generate_master_key()
        encrypted_data = ABESimulator.encrypt_file(file_bytes, file_key)
        
        file_id = f"file_{int(datetime.utcnow().timestamp())}"
        chunk_metadata = storage_manager.split_and_upload(file_id, encrypted_data)
        
        file_document = {
            "file_id": file_id, "filename": file.filename, "policy": policy,
            "key": file_key.decode('utf-8'), "chunks": chunk_metadata, "uploaded_at": datetime.utcnow()
        }
        files_collection.insert_one(file_document)
        
        return {"status": "success", "file_id": file_id, "filename": file.filename, "policy_applied": policy, "message": "File encrypted and uploaded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.post("/download-and-decrypt")
async def download_and_decrypt(file_id: str, user_id: str, username: str = Depends(get_current_username)):
    file_record = files_collection.find_one({"file_id": file_id})
    user_record = users_collection.find_one({"username": user_id})
    
    if not file_record: raise HTTPException(status_code=404, detail="File not found")
    if not user_record: raise HTTPException(status_code=404, detail="User not found")
        
    # Bypass mathematical ABE evaluation entirely if the policy is "public"
    is_public = file_record["policy"].strip().lower() == "public"
    
    if not is_public:
        has_access = ABESimulator.evaluate_policy(file_record["policy"], user_record["attributes"])
        if not has_access:
            raise HTTPException(status_code=403, detail=f"Access Denied: Attributes do not satisfy policy.")
        
    try:
        reconstructed_encrypted_data = storage_manager.download_and_reconstruct(file_id, file_record["chunks"])
        decryption_key = file_record["key"].encode('utf-8')
        decrypted_data = ABESimulator.decrypt_file(reconstructed_encrypted_data, decryption_key)
        
        # Return the actual file as a downloadable stream with the original filename
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{file_record["filename"]}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)