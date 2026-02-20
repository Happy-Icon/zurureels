import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import CityPulse from "./pages/CityPulse";
import Bookings from "./pages/Bookings";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import Host from "./pages/Host";
import Listings from "./pages/host/Listings";
import BookingsHost from "./pages/host/Bookings";
import Verification from "./pages/host/Verification";
import BecomeHost from "./pages/BecomeHost";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PersonalInfo } from "@/pages/profile/PersonalInfo";
import { PaymentMethods } from "@/pages/profile/PaymentMethods";
import { Security } from "@/pages/profile/Security";
import { ComingSoon } from "@/pages/profile/ComingSoon";
import Support from "@/pages/profile/Support";
import Settings from "@/pages/profile/Settings";
import { Notifications } from "@/pages/profile/Notifications";
import Messages from "@/pages/profile/Messages";

import AdminDashboard from "./pages/admin/AdminDashboard";
import Broadcasts from "./pages/admin/Broadcasts";

import { VerifiedRoute } from "@/components/VerifiedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CityPulse />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/host" element={<VerifiedRoute><Host /></VerifiedRoute>} />
            <Route path="/host/listings" element={<VerifiedRoute><Listings /></VerifiedRoute>} />
            <Route path="/host/bookings" element={<VerifiedRoute><BookingsHost /></VerifiedRoute>} />
            <Route path="/host/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
            <Route path="/become-host" element={<ProtectedRoute><BecomeHost /></ProtectedRoute>} />
            <Route path="/home" element={<Home />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
            <Route path="/profile/payments" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
            <Route path="/profile/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/profile/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/profile/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/broadcasts" element={<AdminRoute><Broadcasts /></AdminRoute>} />

            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
