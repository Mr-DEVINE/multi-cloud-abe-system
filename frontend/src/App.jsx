import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, Download, ShieldCheck, ShieldAlert, Lock, UserPlus, LogOut } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

// Pre-defined attributes for the system
const AVAILABLE_ATTRIBUTES = ['hr', 'manager', 'it', 'intern', 'director', 'finance'];

function App() {
  // --- Global Auth State ---
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // { username, attributes }

  // --- Auth View State ---
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '', attributes: [] });
  const [authMessage, setAuthMessage] = useState(null);

  // --- Dashboard State ---
  const [file, setFile] = useState(null);
  const [policy, setPolicy] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [downloadFileId, setDownloadFileId] = useState('');
  const [downloadStatus, setDownloadStatus] = useState(null);

  // ==========================================
  //         AUTHENTICATION HANDLERS
  // ==========================================

  const handleAttributeToggle = (attr) => {
    setAuthForm((prev) => {
      const attributes = prev.attributes.includes(attr)
        ? prev.attributes.filter((a) => a !== attr)
        : [...prev.attributes, attr];
      return { ...prev, attributes };
    });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage(null);

    try {
      if (isLoginView) {
        // LOGIN
        const res = await axios.post(`${API_BASE_URL}/login`, {
          username: authForm.username,
          password: authForm.password
        });
        setToken(res.data.access_token);
        setCurrentUser({ username: res.data.username, attributes: res.data.attributes });
      } else {
        // SIGNUP
        const res = await axios.post(`${API_BASE_URL}/signup`, {
          username: authForm.username,
          password: authForm.password,
          attributes: authForm.attributes
        });
        setAuthMessage({ type: 'success', text: res.data.message + " You can now log in." });
        setIsLoginView(true); // Switch to login view after successful signup
      }
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.detail || 'Authentication failed.' });
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setAuthForm({ username: '', password: '', attributes: [] });
    setUploadStatus(null);
    setDownloadStatus(null);
  };

  // ==========================================
  //           DASHBOARD HANDLERS
  // ==========================================

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !policy) return alert('Please provide a file and a policy.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('policy', policy);

    try {
      setUploadStatus({ type: 'loading', msg: 'Encrypting and uploading to Multi-Cloud...' });
      const response = await axios.post(`${API_BASE_URL}/encrypt-and-upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}` 
        }
      });
      setUploadStatus({ type: 'success', msg: response.data.message, fileId: response.data.file_id });
      setDownloadFileId(response.data.file_id);
    } catch (error) {
      setUploadStatus({ type: 'error', msg: error.response?.data?.detail || 'Upload failed.' });
    }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!downloadFileId) return alert('Please provide a File ID.');

    try {
      setDownloadStatus({ type: 'loading', msg: 'Evaluating ABE policy...' });
      // Notice we now automatically pass the logged-in user's username
      const response = await axios.post(`${API_BASE_URL}/download-and-decrypt?file_id=${downloadFileId}&user_id=${currentUser.username}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDownloadStatus({ type: 'success', msg: response.data.message });
    } catch (error) {
      setDownloadStatus({ type: 'error', msg: error.response?.data?.detail || 'Access Denied.' });
    }
  };

  // ==========================================
  //                 RENDER
  // ==========================================

  // --- VIEW 1: AUTHENTICATION PORTAL ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-700 tracking-tight">Multi-Cloud ABE System</h1>
          <p className="text-gray-500 mt-2">Secure Data Sharing via Attribute-Based Encryption</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
          <div className="flex items-center justify-center space-x-3 mb-6">
            {isLoginView ? <Lock className="text-blue-600 w-8 h-8" /> : <UserPlus className="text-green-600 w-8 h-8" />}
            <h2 className="text-2xl font-bold">{isLoginView ? 'System Login' : 'Create Account'}</h2>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input 
                type="text" required
                value={authForm.username}
                onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" required
                value={authForm.password}
                onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Render Attribute Selection only during Signup */}
            {!isLoginView && (
              <div className="pt-2 border-t mt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign System Attributes (ABE)</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_ATTRIBUTES.map(attr => (
                    <label key={attr} className="flex items-center space-x-2 text-sm">
                      <input 
                        type="checkbox" 
                        checked={authForm.attributes.includes(attr)}
                        onChange={() => handleAttributeToggle(attr)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="uppercase">{attr}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className={`w-full text-white font-bold py-2 px-4 rounded-lg transition-colors mt-4 ${isLoginView ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
              {isLoginView ? 'Sign In' : 'Register Account'}
            </button>
          </form>

          {authMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm text-center ${authMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {authMessage.text}
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <button onClick={() => { setIsLoginView(!isLoginView); setAuthMessage(null); }} className="text-blue-600 hover:underline">
              {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      
      {/* Top Navigation Bar */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700">ABE Portal</h1>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-sm font-bold">Logged in as: <span className="text-blue-600">{currentUser.username}</span></p>
            <p className="text-xs text-gray-500 uppercase">Attributes: {currentUser.attributes.join(', ') || 'None'}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center space-x-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* DATA OWNER SECTION (UPLOAD) */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 border-b pb-4">
            <UploadCloud className="text-blue-600 w-8 h-8" />
            <h2 className="text-2xl font-semibold">Data Owner (Upload)</h2>
          </div>
          
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full border border-gray-300 p-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Policy (ABE)</label>
              <input 
                type="text" 
                placeholder="e.g., HR and Manager" 
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              Encrypt & Distribute to Clouds
            </button>
          </form>

          {uploadStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center space-x-2 ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {uploadStatus.type === 'success' ? <ShieldCheck className="w-5 h-5"/> : <ShieldAlert className="w-5 h-5"/>}
              <span>{uploadStatus.msg}</span>
            </div>
          )}
          {uploadStatus?.fileId && (
             <div className="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded border border-gray-200">
               <strong>Generated File ID:</strong> <span className="font-mono text-blue-600">{uploadStatus.fileId}</span>
             </div>
          )}
        </div>

        {/* DATA CONSUMER SECTION (DOWNLOAD) */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 border-b pb-4">
            <Download className="text-purple-600 w-8 h-8" />
            <h2 className="text-2xl font-semibold">Data Consumer (Download)</h2>
          </div>

          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File ID</label>
              <input 
                type="text" 
                placeholder="file_123456789" 
                value={downloadFileId}
                onChange={(e) => setDownloadFileId(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-800">
                You are requesting this file as <strong>{currentUser.username}</strong>.<br/>
                Your attributes will be evaluated against the file's cryptographically baked policy.
              </p>
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              Request, Reconstruct & Decrypt
            </button>
          </form>

          {downloadStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center space-x-2 ${downloadStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {downloadStatus.type === 'success' ? <ShieldCheck className="w-5 h-5"/> : <ShieldAlert className="w-5 h-5"/>}
              <span>{downloadStatus.msg}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;