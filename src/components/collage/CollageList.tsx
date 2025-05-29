import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCollageStore } from '../../store/collageStore';
import { Image, ExternalLink, Edit } from 'lucide-react';

const CollageList: React.FC = () => {
  const { collages, loading, error, fetchCollages } = useCollageStore();

  useEffect(() => {
    fetchCollages();
  }, [fetchCollages]);

  if (loading && collages.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="mt-2 text-gray-400">Loading collages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/20 border border-red-500/50 rounded">
        <p className="text-red-200">Error: {error}</p>
      </div>
    );
  }

  if (collages.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-gray-700 rounded-lg bg-gray-900/50">
        <Image className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-2 text-sm font-semibold text-gray-300">No collages yet</h3>
        <p className="mt-1 text-sm text-gray-500">Create your first collage to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {collages.map((collage) => (
        <div 
          key={collage.id}
          className="relative group rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
        >
          <div className="p-4">
            <h3 className="text-lg font-medium text-white mb-1 truncate">{collage.name}</h3>
            <p className="text-xs text-gray-400 mb-3">
              Created: {new Date(collage.created_at).toLocaleDateString()}
            </p>
            
            <div className="flex items-center text-sm">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                Code: {collage.code}
              </span>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Link
                to={`/dashboard/collage/${collage.id}`}
                className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Link>
              
              <Link
                to={`/collage/${collage.code}`}
                className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CollageList;