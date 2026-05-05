Secure Data Sharing in Multi-Cloud Environments Using Attribute-Based Encryption

📌 Project Overview

This project is an enterprise-grade, secure data-sharing platform designed to eliminate the "single point of trust" vulnerability inherent in traditional cloud storage. By combining Ciphertext-Policy Attribute-Based Encryption (CP-ABE), Hybrid AES Encryption, and Multi-Cloud Data Splitting, this system ensures that cloud providers can never access the plaintext data stored on their servers.

Access control is mathematically embedded into the ciphertext. A file encrypted with the policy (HR AND Manager) OR Director can only be decrypted by a user whose cryptographically verified attributes satisfy that exact Boolean logic.

🚀 Key Features

Hybrid Cryptography: Fast AES-256 for file encryption, secured by CP-ABE for the encryption key.

Multi-Cloud Splitting: Ciphertext is sliced into 3 chunks and distributed across simulated/real AWS S3, Azure Blob, and Google Cloud Storage nodes.

Smart Storage Manager: Built-in fault tolerance. Defaults to local simulated cloud folders (./cloud_aws, etc.) if live cloud API keys are missing.

Identity & Access Management (IAM): A dedicated Admin Governance panel for approving accounts and assigning cryptographic attributes.

Interactive Policy Builder: A UI-driven approach for Data Owners to construct error-free ABE mathematical policies.

Public/Private Segregation: Unapproved users are strictly limited to accessing files tagged with the 'Public' policy.

🛠️ Technology Stack

Frontend: React.js 19, Vite, Tailwind CSS, Axios, Lucide-React

Backend: Python 3.13, FastAPI, Uvicorn

Database: MongoDB Atlas (Cloud NoSQL)

Security: Bcrypt (Password Hashing), JSON Web Tokens (JWT), Python cryptography

Cloud SDKs: boto3 (AWS), azure-storage-blob, google-cloud-storage

⚙️ Installation & Setup Guide

1. Prerequisites

Python 3.10+ installed

Node.js (v18+) installed

A free MongoDB Atlas account and database URI.

2. Backend Setup

Open a terminal and navigate to the backend directory:

cd backend


Create and activate a Python virtual environment:

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate


Install the required Python dependencies:

pip install -r requirements.txt


Set up your Environment Variables. Create a .env file in the backend folder:

MONGODB_URI=mongodb+srv://<username>:<password>@cluster0...
# Cloud credentials (Optional - system will use local simulation if left blank)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_BUCKET_NAME=
AZURE_CONNECTION_STRING=
AZURE_CONTAINER_NAME=
GOOGLE_APPLICATION_CREDENTIALS=
GCP_BUCKET_NAME=


Start the FastAPI Server:

python3 main.py


(The server will run on http://localhost:8000 and automatically create a Master Admin account on the first run).

3. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

cd frontend


Install Node dependencies and start the React development server:

npm install
npm run dev


(The UI will be accessible at http://localhost:5173)

🧪 How to Test the System

The Admin Account: On the first backend boot, a default admin is created.

Username: admin | Password: admin123

Register a User: Click "Sign Up" and create a new user (e.g., user01). Request attributes like "HR" and "Manager".

IAM Governance: Log in as admin. Go to the Admin Panel, locate user01, approve their account, assign their attributes, and hit save.

Encrypt & Upload: Log in as user01. Click "Upload New File", select a file, use the Interactive Builder to set a policy (e.g., HR AND Manager), and upload. The backend will split the file into 3 parts in the local cloud_* directories.

Decrypt & Download: Click the "Decrypt & Download" button on the file card. The system will verify your attributes against the policy, reconstruct the chunks, and securely download the original file to your machine.