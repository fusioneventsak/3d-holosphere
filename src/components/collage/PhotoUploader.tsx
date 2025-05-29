import React, { useState, useRef } from 'react';
import { useCollageStore } from '../../store/collageStore';
import { Upload, X, Image, Check } from 'lucide-react';

type PhotoUploaderProps = {
  collageId: string;
};

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ collageId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingStatus, setUploadingStatus] = useState<{ [key: string]: 'pending' | 'uploading' | 'success' | 'error' }>({});
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const { uploadPhoto } = useCollageStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Limit to 20 photos
      if (filesArray.length > 20) {
        setError('You can upload a maximum of 20 photos at once');
        return;
      }
      
      // Reset any previous errors
      setError(null);
      
      // Add selected files to state
      setSelectedFiles(filesArray);
      
      // Initialize upload status for each file
      const newStatus: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {};
      filesArray.forEach(file => {
        newStatus[file.name] = 'pending';
      });
      setUploadingStatus(newStatus);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
    setUploadingStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || uploading) return;
    
    setUploading(true);
    
    // Begin upload for each file
    for (const file of selectedFiles) {
      try {
        setUploadingStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
        
        // Validate collage ID is still available
        if (!collageId) {
          throw new Error('Collage ID is missing or invalid');
        }
        
        // Upload to Supabase
        const result = await uploadPhoto(collageId, file);
        
        if (result) {
          setUploadingStatus(prev => ({ ...prev, [file.name]: 'success' }));
          console.log(`Successfully uploaded photo: ${file.name}`);
        } else {
          throw new Error('Failed to upload photo');
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        setUploadingStatus(prev => ({ ...prev, [file.name]: 'error' }));
        setError(err.message || 'An error occurred during upload. Please try again.');
      }
    }
    
    setUploading(false);
    
    // Clear successful uploads after a delay
    setTimeout(() => {
      setSelectedFiles(prev => 
        prev.filter(file => uploadingStatus[file.name] !== 'success')
      );
      
      setUploadingStatus(prev => {
        const newStatus = { ...prev };
        Object.keys(newStatus).forEach(key => {
          if (newStatus[key] === 'success') {
            delete newStatus[key];
          }
        });
        return newStatus;
      });
    }, 3000);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      
      // Limit to 20 photos
      if (filesArray.length > 20) {
        setError('You can upload a maximum of 20 photos at once');
        return;
      }
      
      // Reset any previous errors
      setError(null);
      
      // Add selected files to state
      setSelectedFiles(filesArray);
      
      // Initialize upload status for each file
      const newStatus: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {};
      filesArray.forEach(file => {
        newStatus[file.name] = 'pending';
      });
      setUploadingStatus(newStatus);
    }
  };

  const getUploadStatusColor = (status: 'pending' | 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'uploading': return 'bg-blue-500 animate-pulse';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getUploadStatusIcon = (status: 'pending' | 'uploading' | 'success' | 'error') => {
    switch (status) {
      case 'pending': return null;
      case 'uploading': return (
        <svg className="animate-spin h-4 w-4 text-white\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24">
          <circle className="opacity-25\" cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" strokeWidth=\"4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
      case 'success': return <Check className="h-4 w-4 text-white" />;
      case 'error': return <X className="h-4 w-4 text-white" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-4">Upload Photos</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
          {error}
        </div>
      )}
      
      <div 
        className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/*"
          className="hidden"
        />
        
        <Image className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-1 text-sm text-gray-400">
          Drag and drop images, or click to select files
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG, GIF up to 10MB
        </p>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`inline-flex items-center px-3 py-1 text-xs bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded hover:from-purple-700 hover:to-blue-600 transition-colors ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24">
                    <circle className="opacity-25\" cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" strokeWidth=\"4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                <>
                  <Upload className="h-3 w-3 mr-1" />
                  Upload All
                </>
              )}
            </button>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between py-2 px-3 bg-black/30 rounded mb-2 text-sm"
              >
                <div className="flex items-center overflow-hidden">
                  <div className={`h-3 w-3 rounded-full mr-2 ${getUploadStatusColor(uploadingStatus[file.name])}`}>
                    {getUploadStatusIcon(uploadingStatus[file.name])}
                  </div>
                  <span className="truncate">{file.name}</span>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.name)}
                  className="text-gray-400 hover:text-red-400 transition-colors ml-2"
                  disabled={uploadingStatus[file.name] === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;