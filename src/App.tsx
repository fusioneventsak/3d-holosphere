import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CollageEditorPage from './pages/CollageEditorPage';
import CollageViewerPage from './pages/CollageViewerPage';
import CollageModerationPage from './pages/CollageModerationPage';
import PhotoboothPage from './pages/PhotoboothPage';
import JoinCollage from './pages/JoinCollage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/join" element={<JoinCollage />} />
        <Route path="/collage/:code" element={<CollageViewerPage />} />
        <Route path="/photobooth/:code" element={<PhotoboothPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/collage/:id" element={<CollageEditorPage />} />
        
        {/* FIXED: Changed from /moderation/:id to /collage/:id/moderation */}
        <Route path="/collage/:id/moderation" element={<CollageModerationPage />} />
        
        {/* Keep the old route for backwards compatibility if needed */}
        <Route path="/moderation/:id" element={<CollageModerationPage />} />
      </Routes>
    </Router>
  );
}

export default App;