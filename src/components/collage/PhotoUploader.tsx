import React, { useState, useRef, useCallback } from 'react';
import { useCollageStore } from '../../store/collageStore';
import { Upload, X, Image, Check, AlertCircle } from 'lucide-react';

type PhotoUploaderProps = {
  collageId: string;
};

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

type FileUpload = {
  file: File;
  id: string;
  status: UploadStatus;
  progress: number;
  error?: string;
};

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ collageId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { uploadPhoto } = useCollageStore();

  // Generate unique ID for each file
  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const updateFileStatus = useCallback((fileId: string, updates: Partial<FileUpload>) => {
    setFileUploads(prev => 
      prev.map(upload => 
        upload.id === fileId 
          ? { ...upload, ...updates }
          : upload
      )
    );
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFileUploads(prev => prev.filter(upload => upload.id !== fileId));
  }, []);

  const validateFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10MB limit';
    }

    if (!validImageTypes.includes(file.type)) {
      return 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are supported.';
    }

    return null;
  };

  const handleFileSelect = (files: File[]) => {
    setGlobalError(null);

    // Limit to 50 photos at once for better performance
    if (files.length > 50) {
      setGlobalError('You can upload a maximum of 50 photos at once');
      return;
    }

    const newUploads: FileUpload[] = [];
    const validFiles: FileUpload[] = [];

    files.forEach(file => {
      const fileId = generateFileId();
      const validationError = validateFile(file);
      
      const upload: FileUpload = {
        file,
        id: fileId,
        status: validationError ? 'error' : 'pending',
        progress: 0,
        error: validationError || undefined
      };

      newUploads.push(upload);
      
      if (!validationError) {
        validFiles.push(upload);
      }
    });

    setFileUploads(prev => [...prev, ...newUploads]);

    // Start uploading valid files immediately
    if (validFiles.length > 0) {
      processUploads(validFiles);
    }
  };

  const processUploads = async (uploads: FileUpload[]) => {
    setIsUploading(true);

    // Process uploads in parallel batches for better performance
    const BATCH_SIZE = 3; // Process 3 files at a time
    const batches: FileUpload[][] = [];
    
    for (let i = 0; i < uploads.length; i += BATCH_SIZE) {
      batches.push(uploads.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const uploadPromises = batch.map(async (upload) => {
        try {
          updateFileStatus(upload.id, { status: 'uploading', progress: 10 });

          // Simulate progress updates for better UX
          const progressInterval = setInterval(() => {
            updateFileStatus(upload.id, (prev) => ({
              progress: Math.min(prev.progress + Math.random() * 20, 90)
            }));
          }, 200);

          const result = await uploadPhoto(collageId, upload.file);

          clearInterval(progressInterval);

          if (result) {
            updateFileStatus(upload.id, { 
              status: 'success', 
              progress: 100 
            });
            
            // Auto-remove successful uploads after 2 seconds
            setTimeout(() => {
              removeFile(upload.id);
            }, 2000);
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

  const getStatusIcon = (status: UploadStatus) => {
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
      default: 
        return null;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'uploading': return 'bg-blue-500';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const completedCount = fileUploads.filter(u => u.status === 'success').length;
  const errorCount = fileUploads.filter(u => u.status === 'error').length;
  const uploadingCount = fileUploads.filter(u => u.status === 'uploading').length;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Upload Photos</h3>
        {fileUploads.length > 0 && (
          <button
            onClick={clearCompletedUploads}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear Completed
          </button>
        )}
      </div>
      
      {globalError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
          {globalError}
        </div>
      )}

      {/* Upload Status Summary */}
      {(isUploading || completedCount > 0 || errorCount > 0) && (
        <div className="mb-4 p-3 bg-black/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              {uploadingCount > 0 && (
                <span className="text-blue-400">
                  {uploadingCount} uploading...
                </span>
              )}
              {completedCount > 0 && (
                <span className="text-green-400">
                  {completedCount} completed
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400">
                  {errorCount} failed
                </span>
              )}
            </div>
            {isUploading && (
              <div className="text-xs text-gray-400">
                Photos will appear automatically
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Drop Zone */}
      <div 
        className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-white/5 transition-colors relative"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          multiple
          accept="image/*"
          className="hidden"
        />
        
        <Image className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          Drag and drop images, or click to select files
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG, GIF, WebP up to 10MB each • Max 50 files at once
        </p>
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-white">Processing uploads...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Upload Progress List */}
      {fileUploads.length > 0 && (
        <div className="mt-4">
          <div className="max-h-48 overflow-y-auto space-y-2">
            {fileUploads.map((upload) => (
              <div 
                key={upload.id}
                className="flex items-center justify-between py-2 px-3 bg-black/30 rounded text-sm"
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className="flex-shrink-0 mr-3">
                    {getStatusIcon(upload.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-gray-300">
                        {upload.file.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {(upload.file.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    </div>
                    
                    {upload.status === 'uploading' && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div 
                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {upload.error && (
                      <div className="mt-1 text-xs text-red-400">
                        {upload.error}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center ml-2 space-x-2">
                  {upload.status === 'error' && (
                    <button
                      onClick={() => handleRetryUpload(upload)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeFile(upload.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                    disabled={upload.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;