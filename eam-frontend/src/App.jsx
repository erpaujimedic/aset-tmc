import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layouts & Guards (Keep static since they wrap everything)
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ShimmerLoader from './components/ui/ShimmerLoader';

// Pages (Lazy Load for Extreme Performance & Code Splitting)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assets = lazy(() => import('./pages/Assets'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const Borrowing = lazy(() => import('./pages/Borrowing'));
const Calibrations = lazy(() => import('./pages/Calibrations'));
const Ticketing = lazy(() => import('./pages/Ticketing'));
const PublicAssetPortal = lazy(() => import('./pages/PublicAssetPortal'));
const Roles = lazy(() => import('./pages/user-managements/Roles'));
const Users = lazy(() => import('./pages/user-managements/Users'));
const ProfileConfigurations = lazy(() => import('./pages/user-managements/ProfileConfigurations'));
const SLASettings = lazy(() => import('./pages/settings/SLASettings'));
const FileNamingConfig = lazy(() => import('./pages/settings/FileNamingConfig'));
const MasterComponentSettings = lazy(() => import('./pages/MasterComponentSettings'));

const PageFallback = () => (
  <div className="p-8 w-full h-[80vh] flex flex-col gap-8 items-center">
    <ShimmerLoader type="card" className="w-full max-w-4xl h-32" />
    <ShimmerLoader type="table" rows={6} className="w-full max-w-4xl" />
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50"><ShimmerLoader type="card" className="w-80 h-32" /></div>}>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/public-asset/:id" element={<PublicAssetPortal />} />

          {/* PROTECTED ROUTES */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
              <Route path="/assets" element={<Suspense fallback={<PageFallback />}><Assets /></Suspense>} />
              <Route path="/calibrations" element={<Suspense fallback={<PageFallback />}><Calibrations /></Suspense>} />
              <Route path="/deliveries" element={<Suspense fallback={<PageFallback />}><Deliveries /></Suspense>} />
              <Route path="/borrowing" element={<Suspense fallback={<PageFallback />}><Borrowing /></Suspense>} />
              <Route path="/ticketing" element={<Suspense fallback={<PageFallback />}><Ticketing /></Suspense>} />
              {/* USER MANAGEMENTS ROUTES */}
              <Route path="/user-managements/roles" element={<Suspense fallback={<PageFallback />}><Roles /></Suspense>} />
              <Route path="/user-managements/profile-configurations" element={<Suspense fallback={<PageFallback />}><ProfileConfigurations /></Suspense>} />
              <Route path="/user-managements/users" element={<Suspense fallback={<PageFallback />}><Users /></Suspense>} />
              {/* SETTINGS */}
              <Route path="/settings/sla-settings" element={<Suspense fallback={<PageFallback />}><SLASettings /></Suspense>} />
              <Route path="/settings/file-naming" element={<Suspense fallback={<PageFallback />}><FileNamingConfig /></Suspense>} />
              <Route path="/settings/master-components" element={<Suspense fallback={<PageFallback />}><MasterComponentSettings /></Suspense>} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}