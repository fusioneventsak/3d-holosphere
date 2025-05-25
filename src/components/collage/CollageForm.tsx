import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollageStore } from '../../store/collageStore';
import { PlusIcon } from 'lucide-react';

const CollageForm: React.FC = () => {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createCollage } = useCollageStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name for your collage');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      const collage = await createCollage(name);
      if (collage) {
        navigate(`/dashboard/collage/${collage.id}`);
      } else {
        throw new Error('Failed to create collage');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create collage');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
      <h3 className="text-lg font-medium mb-4">Create New Collage</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="collageName" className="block text-sm font-medium text-gray-300 mb-1">
            Collage Name
          </label>
          <input
            id="collageName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/30 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="My Awesome Collage"
            disabled={isCreating}
          />
        </div>
        
        <button
          type="submit"
          disabled={isCreating}
          className={`w-full flex items-center justify-center py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-md hover:from-purple-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
            isCreating ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isCreating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Collage
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CollageForm;