import { UploadCloud, FileText, CheckCircle, Loader, X, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function UploadArea({ materials, setMaterials, currentUser, currentUserName, onNavigateToChangePassword }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(nf => {
        const isDuplicateMat = materials.some(m => m.name === nf.name);
        const isDuplicateSel = files.some(f => f.name === nf.name);
        if (isDuplicateMat || isDuplicateSel) {
          alert(`Lỗi: File "${nf.name}" đã được upload hoặc đã được chọn.`);
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (fileName) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const simulateUpload = () => {
    if (files.length === 0) return;
    setIsUploading(true);

    files.forEach(async (file) => {
      const newMaterialId = Date.now() + Math.random();
      const newMaterial = {
        id: newMaterialId,
        name: file.name,
        status: 'processing',
        progress: 0,
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        time: new Date().toLocaleString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        owner: currentUser
      };

      setMaterials(prev => [newMaterial, ...prev]);

      // UX: Giả lập tiến độ chạy lên 90% trong lúc chờ Server
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 10) + 5;
        if (currentProgress >= 90) {
          currentProgress = 90;
        }
        setMaterials(prev => prev.map(m =>
          m.id === newMaterialId ? { ...m, progress: currentProgress } : m
        ));
      }, 500);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('currentUser', currentUser);

        const response = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Upload failed');
        }

        // Thành công -> Bơm đầy 100%
        clearInterval(interval);
        
        // Lưu vào Cloud Supabase
        const { error: dbError } = await supabase.from('rag_materials').insert({
          name: newMaterial.name,
          size: newMaterial.size,
          time: newMaterial.time,
          status: 'indexed',
          progress: 100,
          owner: currentUser
        });
        
        if (dbError) console.error("Lỗi khi lưu thông tin file lên Cloud:", dbError);

        setMaterials(prev => prev.map(m =>
          m.id === newMaterialId ? { ...m, status: 'indexed', progress: 100 } : m
        ));
      } catch (error) {
        clearInterval(interval);
        alert('Lỗi khi tải file lên: ' + error.message);
        // Xóa file khỏi danh sách nếu lỗi
        setMaterials(prev => prev.filter(m => m.id !== newMaterialId));
      }
    });

    setFiles([]);
    setIsUploading(false);
  };

  const deleteMaterial = async (fileName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa file ${fileName} không? Dữ liệu AI sẽ quên hoàn toàn file này.`)) {
      return;
    }

    try {
      // 1. Gọi Backend API để xóa Vector trong ChromaDB/Supabase
      const response = await fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, currentUser: currentUser }),
      });

      if (!response.ok) {
        throw new Error('Lỗi khi xóa file trên Server');
      }

      // 2. Xóa khỏi Supabase Database
      await supabase.from('rag_materials').delete().eq('name', fileName).eq('owner', currentUser);

      // 3. Xóa khỏi UI
      setMaterials(prev => prev.filter(m => m.name !== fileName));
      alert('Đã xóa file thành công!');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-base-100 overflow-y-auto w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Upload File</h2>
          <p className="text-gray-500">Feed your Chatbot RAG system with new PDFs to expand its knowledge base.</p>
        </div>
      </div>

      {/* Drag & Drop Main Box */}
      <div className="border-2 border-primary rounded-[2rem] bg-white p-12 flex flex-col items-center justify-center mb-10 shadow-sm relative overflow-hidden group">
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 text-white shadow-lg transition-transform group-hover:scale-105">
          <UploadCloud className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Drag & Drop your PDFs here</h3>
        <p className="text-gray-400 mb-6">or click to browse from your device</p>

        <button className="bg-primary text-white font-semibold py-3 px-8 rounded-xl shadow-md hover:bg-primary-focus transition-colors pointer-events-none">
          {files.length > 0 ? `Selected: ${files.length} file(s)` : "Browse Files"}
        </button>

        {files.length > 0 && !isUploading && (
          <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); simulateUpload(); }} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-lg z-20 relative cursor-pointer hover:bg-gray-700 font-bold shadow-md">
            Confirm Upload
          </button>
        )}

        <p className="text-sm text-gray-400 mt-8">Maximum file size: 20MB. Supported format: .pdf</p>
      </div>

      {/* Selected Files Queue */}
      {files.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-bold text-gray-800">Files to Upload</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-gray-700 text-sm truncate" title={f.name}>{f.name}</span>
                </div>
                <button
                  onClick={() => removeFile(f.name)}
                  className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Materials List */}
      {currentUser && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-bold text-gray-800">Uploaded Materials</h3>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
              You haven't uploaded any materials yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map((mat, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    {mat.status === 'indexed' ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Indexed
                        </span>
                        <button 
                          onClick={() => deleteMaterial(mat.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Xóa file này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="bg-blue-100 text-blue-600 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                        <Loader className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-gray-800 truncate" title={mat.name}>{mat.name}</h4>
                  <p className="text-sm text-gray-500 mb-4">{mat.status === 'indexed' ? 'Ready for queries.' : 'Uploading and chunking text...'}</p>

                  {mat.status === 'processing' ? (
                    <div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${mat.progress}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 font-medium">
                        <span>{mat.progress}%</span>
                        <span>{mat.size}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 border border-gray-100 rounded-md py-1.5 px-3 flex items-center gap-1 font-medium bg-gray-50/50">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {mat.time} • {mat.size}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
