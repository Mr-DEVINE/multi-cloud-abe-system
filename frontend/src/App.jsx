import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, LayoutDashboard, Folder, UploadCloud, 
  File, Lock, LogOut, CheckCircle, AlertTriangle, 
  X, Cloud, FileText, Users, Edit3, UserCheck, Clock, Unlock
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';
const AVAILABLE_ATTRIBUTES = ['hr', 'manager', 'it', 'intern', 'director', 'finance', 'cloud', 'senior'];

function App() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '', attributes: [] });
  const [authMessage, setAuthMessage] = useState(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'admin'

  const [files, setFiles] = useState([
    { file_id: 'mock_1', filename: 'Project_Report_Final.pdf', policy: 'it and manager', uploaded_at: '2025-11-20', size: '2.4 MB' },
    { file_id: 'mock_2', filename: 'HR_Policies_2025.docx', policy: 'hr or senior', uploaded_at: '2025-11-18', size: '1.1 MB' },
    { file_id: 'mock_3', filename: 'Company_Welcome_Guide.pdf', policy: 'public', uploaded_at: '2025-11-24', size: '500 KB' },
  ]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPolicy, setUploadPolicy] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [toast, setToast] = useState(null);

  // Admin State
  const [systemUsers, setSystemUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage(null);
    try {
      if (isLoginView) {
        const res = await axios.post(`${API_BASE_URL}/login`, { username: authForm.username, password: authForm.password });
        setToken(res.data.access_token);
        setCurrentUser({ 
          username: res.data.username, 
          attributes: res.data.attributes, 
          is_admin: res.data.is_admin,
          is_approved: res.data.is_approved ?? (res.data.attributes.length > 0) // Fallback if backend doesn't send it
        });
        setActiveTab('dashboard');
      } else {
        const res = await axios.post(`${API_BASE_URL}/signup`, { username: authForm.username, password: authForm.password, attributes: authForm.attributes });
        setAuthMessage({ type: 'success', text: "Account created! You can log in, but private access is pending Admin approval." });
        setIsLoginView(true);
      }
    } catch (error) {
      setAuthMessage({ type: 'error', text: error.response?.data?.detail || 'Authentication failed.' });
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setAuthForm({ username: '', password: '', attributes: [] });
  };

  // --- Dashboard Handlers ---
  const appendToPolicy = (text) => {
    if (text === 'public') {
      setUploadPolicy('public');
      return;
    }
    setUploadPolicy((prev) => {
      if (prev === 'public') return text + ' ';
      const space = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return prev + space + text + ' ';
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadPolicy) return alert('Please provide a file and a policy.');
    const formData = new FormData();
    formData.append('file', uploadFile); formData.append('policy', uploadPolicy);

    try {
      setUploadStatus({ type: 'loading' });
      const response = await axios.post(`${API_BASE_URL}/encrypt-and-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      setFiles([{ file_id: response.data.file_id, filename: response.data.filename, policy: response.data.policy_applied, uploaded_at: new Date().toISOString().split('T')[0], size: 'Encrypted' }, ...files]);
      setIsUploadModalOpen(false); setUploadFile(null); setUploadPolicy(''); setUploadStatus(null);
      showToast("File encrypted & distributed to multi-cloud!", "success");
    } catch (error) {
      setUploadStatus({ type: 'error', msg: error.response?.data?.detail || 'Upload failed.' });
    }
  };

  const handleDownload = async (fileId, originalFilename = "downloaded_file") => {
    try {
      showToast("Evaluating ABE Policy...", "loading");
      const res = await axios.post(`${API_BASE_URL}/download-and-decrypt?file_id=${fileId}&user_id=${currentUser.username}`, {}, { 
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob' // THIS IS CRUCIAL: It tells Axios we are expecting a file!
      });
      
      // Force the browser to download the file
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Try to extract the real filename from headers, otherwise fallback
      const contentDisposition = res.headers['content-disposition'];
      let fileName = originalFilename;
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }
      link.setAttribute('download', fileName);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up memory
      
      showToast(`Success! File decrypted and downloaded.`, "success");
    } catch (error) {
      // Because we expected a blob, error messages are also blobs now. We must decode them.
      if (error.response && error.response.data instanceof Blob) {
        const textError = await error.response.data.text();
        try {
          const jsonError = JSON.parse(textError);
          showToast(jsonError.detail || 'Access Denied.', "error");
        } catch (e) {
          showToast('Access Denied.', "error");
        }
      } else {
        showToast(error.response?.data?.detail || 'Access Denied.', "error");
      }
    }
  };

  // --- Admin Handlers ---
  const fetchAdminUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` }});
      setSystemUsers(res.data.users);
    } catch (err) { showToast("Failed to fetch users", "error"); }
  };

  useEffect(() => {
    if (activeTab === 'admin' && currentUser?.is_admin) fetchAdminUsers();
  }, [activeTab]);

  const handleAdminUserUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE_URL}/admin/users/${editingUser.username}`, {
        attributes: editingUser.attributes,
        is_approved: editingUser.is_approved
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      
      showToast(`User ${editingUser.username} updated successfully.`, "success");
      setEditingUser(null);
      fetchAdminUsers();
    } catch (err) {
      showToast("Failed to update user.", "error");
    }
  };

  const handleAdminAttributeToggle = (attr) => {
    setEditingUser((prev) => {
      const attributes = prev.attributes.includes(attr) ? prev.attributes.filter(a => a !== attr) : [...prev.attributes, attr];
      return { ...prev, attributes };
    });
  };

  // ==========================================
  //                 RENDER
  // ==========================================

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans">
        <div className="mb-8 flex items-center space-x-3">
          <Shield className="w-10 h-10 text-blue-600" />
          <h1 className="text-3xl font-extrabold text-slate-800">SecureShare</h1>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">{isLoginView ? 'System Login' : 'Create Account'}</h2>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
              <input type="text" required value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input type="password" required value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {!isLoginView && (
              <div className="pt-4 border-t mt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Request System Attributes</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_ATTRIBUTES.map(attr => (
                    <label key={attr} className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={authForm.attributes.includes(attr)} onChange={() => {
                        setAuthForm(p => ({...p, attributes: p.attributes.includes(attr) ? p.attributes.filter(a=>a!==attr) : [...p.attributes, attr] }))
                      }} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                      <span className="uppercase font-medium">{attr}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-3 font-medium bg-amber-50 p-2 rounded flex items-center"><Clock className="w-4 h-4 mr-1"/> Note: Attributes require Admin approval.</p>
              </div>
            )}
            <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg shadow-md mt-6 ${isLoginView ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
              {isLoginView ? 'Sign In' : 'Register & Request Approval'}
            </button>
          </form>
          {authMessage && ( <div className={`mt-4 p-3 rounded-lg text-sm text-center font-medium ${authMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{authMessage.text}</div> )}
          <div className="mt-6 text-center text-sm">
            <button onClick={() => { setIsLoginView(!isLoginView); setAuthMessage(null); }} className="text-blue-600 font-medium hover:underline">
              {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine if the current user has been approved by an admin
  const isApprovedUser = currentUser.is_approved || currentUser.is_admin;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="p-6 flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-extrabold text-slate-900">SecureShare</span>
          </div>

          <div className="px-4 space-y-2">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold transition ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <LayoutDashboard className="w-5 h-5" /><span>Dashboard</span>
            </button>
            {currentUser.is_admin && (
              <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold transition ${activeTab === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Users className="w-5 h-5" /><span>Admin Panel</span>
              </button>
            )}
          </div>

          <div className="mt-10 px-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Attributes</p>
            <div className="flex flex-wrap gap-2">
              {isApprovedUser && currentUser.attributes.length > 0 ? (
                currentUser.attributes.map(attr => ( <span key={attr} className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full uppercase border border-slate-200">{attr}</span> ))
              ) : ( <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-medium flex items-center"><Clock className="w-3 h-3 mr-1"/>Pending Approval</span> )}
              {currentUser.is_admin && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full uppercase border border-red-200">ADMIN</span>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 flex items-center space-x-3 border border-slate-100">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center uppercase">{currentUser.username.charAt(0)}</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 leading-tight">{currentUser.username}</span>
              <span className="text-xs text-slate-500">{currentUser.is_admin ? 'Administrator' : 'System User'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-3 w-full flex items-center justify-center space-x-2 text-slate-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition text-sm font-medium"><LogOut className="w-4 h-4" /><span>Sign Out</span></button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        
        {/* VIEW: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-8">
              <div><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1><p className="text-slate-500 mt-1">Multi-Cloud Secure Storage System</p></div>
              <button onClick={() => setIsUploadModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-md transition-colors"><UploadCloud className="w-5 h-5" /><span>Upload New File</span></button>
            </div>

            {/* Restricted Access Banner */}
            {!isApprovedUser && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-xl mb-8 flex items-start space-x-4 shadow-sm">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-900">Account Pending Approval</h3>
                  <p className="text-sm mt-1">Your assigned cryptographic attributes are currently pending IT Administrator approval. Until approved, you may only decrypt and download <strong>Public</strong> files.</p>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold text-slate-800 mb-4">Recent Encrypted Uploads</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.map((f, i) => {
                const isPublicFile = f.policy.toLowerCase() === 'public';
                const canAccessFile = isApprovedUser || isPublicFile;

                return (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex space-x-3">
                        <div className={`p-2 rounded-lg h-fit ${isPublicFile ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                          <File className="w-6 h-6" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-slate-800 truncate" title={f.filename}>{f.filename}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{f.size} • {f.uploaded_at}</p>
                        </div>
                      </div>
                      {isPublicFile ? <Unlock className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                    </div>
                    
                    <div className="mb-5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Access Policy</p>
                      <div className={`border rounded-lg p-2 font-mono text-xs truncate ${isPublicFile ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                        {f.policy.toUpperCase()}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => canAccessFile ? handleDownload(f.file_id, f.filename) : showToast("Action restricted. Private files require Admin approval.", "error")} 
                      className={`w-full flex items-center justify-center space-x-2 border py-2.5 rounded-xl font-semibold transition ${canAccessFile ? 'border-slate-200 text-blue-600 hover:bg-blue-50' : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'}`}
                    >
                      {isPublicFile ? <Cloud className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      <span>{isPublicFile ? 'Download (Public)' : 'Decrypt & Download'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {activeTab === 'admin' && currentUser?.is_admin && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Identity & Access Management</h1>
              <p className="text-slate-500 mt-1">Approve accounts and assign ABE cryptographic attributes.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Username</th><th className="p-4">Account Status</th><th className="p-4">Assigned Attributes</th><th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemUsers.map((u) => (
                    <tr key={u.username} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-800">{u.username} {u.is_admin && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase">Admin</span>}</td>
                      <td className="p-4">
                        {u.is_approved ? <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-md flex w-max items-center"><UserCheck className="w-3 h-3 mr-1"/> Approved</span> : <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-md flex w-max items-center"><Clock className="w-3 h-3 mr-1"/> Pending</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {u.attributes.length > 0 ? u.attributes.map(a => <span key={a} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{a}</span>) : <span className="text-xs text-slate-400">None</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => setEditingUser(u)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"><Edit3 className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {toast && (
          <div className={`fixed bottom-8 right-8 flex items-center space-x-3 px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce-short ${toast.type === 'success' ? 'bg-slate-800 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}{toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}{toast.type === 'loading' && <Shield className="w-5 h-5 animate-pulse" />}
            <span className="font-medium text-sm">{toast.msg}</span>
          </div>
        )}
      </div>

      {/* EDIT USER MODAL (ADMIN ONLY) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Edit User: {editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAdminUserUpdate} className="p-6 space-y-5">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div><p className="font-bold text-slate-800">Account Status</p><p className="text-xs text-slate-500">Allow user full attribute access.</p></div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={editingUser.is_approved} onChange={(e) => setEditingUser({...editingUser, is_approved: e.target.checked})} />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Assigned ABE Attributes</label>
                <div className="grid grid-cols-2 gap-3 bg-white border border-slate-200 p-4 rounded-xl">
                  {AVAILABLE_ATTRIBUTES.map(attr => (
                    <label key={attr} className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={editingUser.attributes.includes(attr)} onChange={() => handleAdminAttributeToggle(attr)} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                      <span className="uppercase font-medium">{attr}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition shadow-md">
                Save User Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 flex items-center"><UploadCloud className="w-5 h-5 mr-2 text-blue-600"/> Secure Upload</h3><button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button></div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select File</label>
                <input type="file" onChange={(e) => setUploadFile(e.target.files[0])} className="w-full border border-slate-300 p-2 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Define Access Policy (ABE)</label>
                <input type="text" placeholder="e.g., hr and manager" value={uploadPolicy} onChange={(e) => setUploadPolicy(e.target.value.toLowerCase())} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm mb-3"/>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Interactive Builder</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {AVAILABLE_ATTRIBUTES.map(attr => (<button key={attr} type="button" onClick={() => appendToPolicy(attr)} className="bg-white border border-slate-300 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-xs px-2.5 py-1.5 rounded-md shadow-sm transition font-medium">+{attr.toUpperCase()}</button>))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
                    <button type="button" onClick={() => appendToPolicy('and')} className="bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs px-3 py-1.5 rounded-md font-bold transition">AND</button>
                    <button type="button" onClick={() => appendToPolicy('or')} className="bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs px-3 py-1.5 rounded-md font-bold transition">OR</button>
                    <button type="button" onClick={() => appendToPolicy('(')} className="bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs px-3 py-1.5 rounded-md font-bold transition">(</button>
                    <button type="button" onClick={() => appendToPolicy(')')} className="bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs px-3 py-1.5 rounded-md font-bold transition">)</button>
                    <button type="button" onClick={() => appendToPolicy('public')} className="bg-green-100 text-green-700 hover:bg-green-200 text-xs px-3 py-1.5 rounded-md font-bold transition ml-2">PUBLIC</button>
                    <button type="button" onClick={() => setUploadPolicy('')} className="ml-auto text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 transition">Clear</button>
                  </div>
                </div>
              </div>
              <button disabled={uploadStatus?.type === 'loading'} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-md">{uploadStatus?.type === 'loading' ? 'Encrypting...' : 'Encrypt & Upload'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;