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
import JoinCollage from './pages/JoinCollage';
import StockPhotoManager from './pages/StockPhotoManager';

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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/collage/:id" element={<CollageEditorPage />} />
        <Route path="/moderation/:id" element={<CollageModerationPage />} />
        <Route path="/admin/stock-photos" element={<StockPhotoManager />} />
      </Routes>
    </Router>
  );
}

export default App;