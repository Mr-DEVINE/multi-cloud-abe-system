import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, Download, ShieldCheck, ShieldAlert } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  // --- State for Upload (Data Owner) ---
  const [file, setFile] = useState(null);
  const [policy, setPolicy] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedFileId, setUploadedFileId] = useState('');

  // --- State for Download (Data Consumer) ---
  const [downloadFileId, setDownloadFileId] = useState('');
  const [userId, setUserId] = useState('user_alice'); // Default to Alice
  const [downloadStatus, setDownloadStatus] = useState(null);

  // --- Handlers ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !policy) return alert('Please provide a file and a policy.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('policy', policy);

    try {
      setUploadStatus({ type: 'loading', msg: 'Encrypting and uploading...' });
      const response = await axios.post(`${API_BASE_URL}/encrypt-and-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus({ type: 'success', msg: response.data.message });
      setUploadedFileId(response.data.file_id);
      setDownloadFileId(response.data.file_id); // Auto-fill download side for easy testing
    } catch (error) {
      setUploadStatus({ type: 'error', msg: error.response?.data?.detail || 'Upload failed.' });
    }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!downloadFileId || !userId) return alert('Please provide File ID and User ID.');

    try {
      setDownloadStatus({ type: 'loading', msg: 'Evaluating ABE policy...' });
      const response = await axios.post(`${API_BASE_URL}/download-and-decrypt?file_id=${downloadFileId}&user_id=${userId}`);
      setDownloadStatus({ type: 'success', msg: response.data.message });
    } catch (error) {
      setDownloadStatus({ type: 'error', msg: error.response?.data?.detail || 'Access Denied.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-blue-700 tracking-tight">Multi-Cloud ABE System</h1>
        <p className="text-gray-500 mt-2">Secure Data Sharing via Attribute-Based Encryption</p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* --- DATA OWNER SECTION (UPLOAD) --- */}
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
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Policy (ABE)</label>
              <input 
                type="text" 
                placeholder="e.g., HR and Manager" 
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Defines who can decrypt this file mathematically.</p>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              Encrypt & Upload
            </button>
          </form>

          {uploadStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center space-x-2 ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {uploadStatus.type === 'success' ? <ShieldCheck className="w-5 h-5"/> : <ShieldAlert className="w-5 h-5"/>}
              <span>{uploadStatus.msg}</span>
            </div>
          )}
          {uploadedFileId && (
             <div className="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded border border-gray-200">
               <strong>Generated File ID:</strong> <span className="font-mono text-blue-600">{uploadedFileId}</span>
             </div>
          )}
        </div>

        {/* --- DATA CONSUMER SECTION (DOWNLOAD) --- */}
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
                placeholder="file_1" 
                value={downloadFileId}
                onChange={(e) => setDownloadFileId(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select User (Simulation)</label>
              <select 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="user_alice">Alice (Attributes: HR, Manager)</option>
                <option value="user_bob">Bob (Attributes: IT, Intern)</option>
                <option value="user_charlie">Charlie (Attributes: Director, Finance)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              Request & Decrypt
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