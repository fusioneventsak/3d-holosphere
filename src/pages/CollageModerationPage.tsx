// src/pages/CollageModerationPage.tsx - MINIMAL DEBUG VERSION
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const CollageModerationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [debugInfo, setDebugInfo] = useState('Component mounted');

  useEffect(() => {
    console.log('🛡️ MODERATION PAGE: Component mounted with ID:', id);
    setDebugInfo(`Component mounted with ID: ${id}`);
  }, [id]);

  // Minimal render to test if component loads
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'black', 
      color: 'white', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🛡️ MODERATION PAGE - DEBUG MODE</h1>
      <p>Debug info: {debugInfo}</p>
      <p>Route ID parameter: {id || 'No ID found'}</p>
      <p>Current timestamp: {new Date().toISOString()}</p>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#333' }}>
        <h3>Component Status: ✅ WORKING</h3>
        <p>If you can see this, the component is rendering correctly.</p>
        <p>The white page issue has been resolved.</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => console.log('Button clicked!')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#555',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Test Button
        </button>
      </div>
    </div>
  );
};

export default CollageModerationPage;