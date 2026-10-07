/**
 * Top-level React Router for the Kilowatch admin console.
 * Declares the public login route and nests all admin pages under
 * RequireAdmin + AdminLayout. Unknown paths redirect to the dashboard.
 */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RequireAdmin } from "./auth/AdminGate";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Login from "./pages/Login";
import News from "./pages/News";
import Onboarding from "./pages/Onboarding";
import Providers from "./pages/Providers";
import Support from "./pages/Support";
import FeatureDemo from "./pages/FeatureDemo";
import Users from "./pages/Users";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: sign-in only */}
        <Route path="/login" element={<Login />} />

        {/* Protected shell: admin gate wraps layout + nested pages */}
        <Route
          path="/"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="devices" element={<Devices />} />
          <Route path="providers" element={<Providers />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="news" element={<News />} />
          <Route path="support" element={<Support />} />
          <Route path="demo" element={<FeatureDemo />} />
        </Route>

        {/* Fallback: send unknown URLs home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
