// src/components/collage/PhotoUploader.tsx
import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useCollageStore } from '../../store/collageStore';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUpload {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface PhotoUploaderProps {
  collageId: string;
  onUploadComplete?: () => void;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ collageId, onUploadComplete }) => {
  const { uploadPhoto } = useCollageStore();
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create file upload entries
  const handleFileSelect = (files: File[]) => {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    const validFiles = files.filter(file => {
      if (!validImageTypes.includes(file.type)) {
        alert(`"${file.name}" is not a valid image file. Only JPEG, PNG, GIF, and WebP are supported.`);
        return false;
      }
      if (file.size > maxFileSize) {
        alert(`"${file.name}" is too large. Maximum file size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newUploads: FileUpload[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0
    }));

    setFileUploads(prev => [...prev, ...newUploads]);
    
    // Start processing uploads immediately
    processUploads(newUploads);
  };

  // Update file status
  const updateFileStatus = (id: string, updates: Partial<FileUpload>) => {
    setFileUploads(prev => prev.map(upload => 
      upload.id === id ? { ...upload, ...updates } : upload
    ));
  };

  // Remove file from upload list
  const removeFile = (id: string) => {
    setFileUploads(prev => prev.filter(upload => upload.id !== id));
  };

  // Process uploads with progress tracking
  const processUploads = async (uploads: FileUpload[]) => {
    if (isUploading) return;
    
    setIsUploading(true);
    const batchSize = 3; // Process 3 files at a time to avoid overwhelming

    for (let i = 0; i < uploads.length; i += batchSize) {
      const batch = uploads.slice(i, i + batchSize);
      
      const uploadPromises = batch.map(async (upload) => {
        if (upload.status !== 'pending') return;
        
        try {
          updateFileStatus(upload.id, { 
            status: 'uploading', 
            progress: 10 
          });

          // Simulate upload progress
          const progressInterval = setInterval(() => {
            updateFileStatus(upload.id, { 
              progress: Math.min(90, upload.progress + Math.random() * 20)
            });
          }, 200);

          // Actual upload using the store method
          const result = await uploadPhoto(collageId, upload.file);
          
          clearInterval(progressInterval);

          if (result) {
            updateFileStatus(upload.id, { 
              status: 'success', 
              progress: 100 
            });
            
            console.log('✅ Photo uploaded successfully via uploader:', result.id);
            console.log('🔔 Realtime subscription should handle the UI update automatically');
            
            // Auto-remove successful uploads after 2 seconds
            setTimeout(() => {
              removeFile(upload.id);
            }, 2000);
            
            // Call completion callback if provided
            if (onUploadComplete) {
              onUploadComplete();
            }
          } else {
            throw new Error('Upload failed without specific error');
          }
        } catch (error: any) {
          updateFileStatus(upload.id, { 
            status: 'error', 
            progress: 0,
            error: error.message || 'Upload failed'
          });
        }
      });

      // Wait for current batch to complete before starting next
      await Promise.all(uploadPromises);
    }

    setIsUploading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFileSelect(files);
      // Clear input for next selection
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      handleFileSelect(files);
    }
  };

  const handleRetryUpload = (upload: FileUpload) => {
    updateFileStatus(upload.id, { 
      status: 'pending', 
      progress: 0, 
      error: undefined 
    });
    processUploads([upload]);
  };

  const clearCompletedUploads = () => {
    setFileUploads(prev => prev.filter(upload => 
      upload.status !== 'success' && upload.status !== 'error'
    ));
  };

  const getStatusIcon = (status: UploadStatus, error?: string) => {
    switch (status) {
      case 'pending': 
        return <div className="h-4 w-4 bg-gray-500 rounded-full" />;
      case 'uploading': 
        return (
          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case 'success': 
        return <Check className="h-4 w-4 text-green-400" />;
      case 'error': 
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-700';
      case 'uploading': return 'bg-blue-600';
      case 'success': return 'bg-green-600';
      case 'error': return 'bg-red-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg p-8 text-center transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-semibold text-white mb-2">Upload Photos</p>
        <p className="text-gray-400 mb-4">
          Drag and drop photos here, or click to select files
        </p>
        <p className="text-xs text-gray-500">
          Supports JPEG, PNG, GIF, and WebP • Max 10MB per file
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Upload Progress */}
      {fileUploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              Upload Progress ({fileUploads.length} files)
            </h4>
            {fileUploads.some(u => u.status === 'success' || u.status === 'error') && (
              <button
                onClick={clearCompletedUploads}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2">
            {fileUploads.map((upload) => (
              <div key={upload.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {getStatusIcon(upload.status, upload.error)}
                    <span className="text-sm text-gray-300 truncate">
                      {upload.file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(upload.file.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {upload.status === 'error' && (
                      <button
                        onClick={() => handleRetryUpload(upload)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(upload.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {upload.status === 'uploading' && (
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${getStatusColor(upload.status)}`}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}

                {/* Error Message */}
                {upload.status === 'error' && upload.error && (
                  <p className="text-xs text-red-400 mt-1">{upload.error}</p>
                )}

                {/* Success Message */}
                {upload.status === 'success' && (
                  <p className="text-xs text-green-400 mt-1">
                    Upload successful! Photo will appear in the collage automatically.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">Upload Instructions</h4>
        <ul className="text-xs text-blue-200 space-y-1">
          <li>• Photos will appear in the collage automatically after upload</li>
          <li>• Multiple photos can be uploaded at once</li>
          <li>• Supported formats: JPEG, PNG, GIF, WebP</li>
          <li>• Maximum file size: 10MB per photo</li>
          <li>• No registration required - just upload and enjoy!</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotoUploader;