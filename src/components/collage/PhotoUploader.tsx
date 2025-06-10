// src/components/collage/PhotoUploader.tsx - ENHANCED WITH REAL-TIME UPDATES
import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, RefreshCw, Image, FileImage } from 'lucide-react';
import { useCollageStore } from '../../store/collageStore';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUpload {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  preview?: string;
}

interface PhotoUploaderProps {
  collageId: string;
  onUploadComplete?: () => void;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ collageId, onUploadComplete }) => {
  const { uploadPhoto } = useCollageStore();
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create file upload entries with preview generation
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

    const newUploads: FileUpload[] = validFiles.map(file => {
      const upload = {
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: 'pending' as UploadStatus,
        progress: 0,
        preview: undefined
      };

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, preview: e.target?.result as string } : u
        ));
      };
      reader.readAsDataURL(file);

      return upload;
    });

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
            setFileUploads(prev => prev.map(u => 
              u.id === upload.id && u.progress < 90 ? 
                { ...u, progress: u.progress + Math.random() * 15 } : u
            ));
          }, 200);

          // Actual upload using the store method
          console.log('📸 UPLOADER: Starting upload for:', upload.file.name);
          const result = await uploadPhoto(collageId, upload.file);
          
          clearInterval(progressInterval);

          if (result) {
            updateFileStatus(upload.id, { 
              status: 'success', 
              progress: 100 
            });
            
            console.log('✅ UPLOADER: Photo uploaded successfully:', result.id);
            console.log('🔔 UPLOADER: Real-time subscription will handle the UI update automatically');
            
            // Auto-remove successful uploads after 3 seconds
            setTimeout(() => {
              removeFile(upload.id);
            }, 3000);
            
            // Call completion callback if provided
            if (onUploadComplete) {
              onUploadComplete();
            }
          } else {
            throw new Error('Upload failed without specific error');
          }
        } catch (error: any) {
          console.error('❌ UPLOADER: Upload failed:', error);
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

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const getStatusIcon = (upload: FileUpload) => {
    switch (upload.status) {
      case 'pending':
        return <FileImage className="w-4 h-4 text-gray-400" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-600';
      case 'uploading': return 'bg-blue-600';
      case 'success': return 'bg-green-600';
      case 'error': return 'bg-red-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-purple-400 bg-purple-400/10' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-white mb-2">
              {dragActive ? 'Drop photos here' : 'Upload Photos'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Drag and drop photos here, or click to browse
            </p>
            
            <button
              onClick={openFileDialog}
              disabled={isUploading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md transition-colors text-sm"
            >
              Choose Files
            </button>
          </div>
          
          <div className="text-xs text-gray-500">
            Supports JPEG, PNG, GIF, WebP • Max 10MB per file
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      {fileUploads.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">Upload Queue ({fileUploads.length})</h4>
            {fileUploads.some(u => u.status === 'success') && (
              <button
                onClick={() => setFileUploads(prev => prev.filter(u => u.status !== 'success'))}
                className="text-gray-400 hover:text-white text-sm"
              >
                Clear completed
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {fileUploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg"
              >
                {/* Preview */}
                <div className="w-12 h-12 bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                  {upload.preview ? (
                    <img
                      src={upload.preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(upload)}
                    <p className="text-white text-sm font-medium truncate">
                      {upload.file.name}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-gray-400 text-xs">
                      {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    
                    {upload.status === 'uploading' && (
                      <>
                        <span className="text-gray-400">•</span>
                        <p className="text-blue-400 text-xs">
                          {Math.round(upload.progress)}%
                        </p>
                      </>
                    )}
                    
                    {upload.status === 'error' && upload.error && (
                      <>
                        <span className="text-gray-400">•</span>
                        <p className="text-red-400 text-xs">
                          {upload.error}
                        </p>
                      </>
                    )}
                    
                    {upload.status === 'success' && (
                      <>
                        <span className="text-gray-400">•</span>
                        <p className="text-green-400 text-xs">
                          Uploaded successfully
                        </p>
                      </>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  {upload.status === 'uploading' && (
                    <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center space-x-1">
                  {upload.status === 'error' && (
                    <button
                      onClick={() => processUploads([upload])}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Retry upload"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  
                  {(upload.status === 'pending' || upload.status === 'error') && (
                    <button
                      onClick={() => removeFile(upload.id)}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Upload Summary */}
          <div className="border-t border-gray-600 pt-3 mt-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-gray-400">
                  {fileUploads.filter(u => u.status === 'success').length} completed
                </span>
                <span className="text-gray-400">
                  {fileUploads.filter(u => u.status === 'uploading').length} uploading
                </span>
                <span className="text-gray-400">
                  {fileUploads.filter(u => u.status === 'error').length} failed
                </span>
              </div>
              
              {isUploading && (
                <div className="flex items-center space-x-2 text-blue-400">
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Tips */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-300 font-medium mb-2">📸 Upload Tips</h4>
        <ul className="text-blue-200 text-sm space-y-1">
          <li>• Photos will appear in the collage instantly after upload</li>
          <li>• Best quality: Use high-resolution images (1080p or higher)</li>
          <li>• Supported formats: JPEG, PNG, GIF, WebP</li>
          <li>• Maximum file size: 10MB per photo</li>
          <li>• Upload multiple photos at once for faster processing</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotoUploader;