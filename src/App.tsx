import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CollageEditorPage from './pages/CollageEditorPage';
import CollageViewerPage from './pages/CollageViewerPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/collage/:code" element={<CollageViewerPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/collage/:id" element={<CollageEditorPage />} />
      </Routes>
    </Router>
  );
}

export default App;