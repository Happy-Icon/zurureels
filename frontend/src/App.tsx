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
import HostSignup from "./pages/HostSignup";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PersonalInfo } from "@/pages/profile/PersonalInfo";
import { PaymentMethods } from "@/pages/profile/PaymentMethods";
import { ComingSoon } from "@/pages/profile/ComingSoon";

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
            <Route path="/host" element={<Host />} />
            <Route path="/host/signup" element={<HostSignup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
            <Route path="/profile/payments" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
            <Route path="/profile/notifications" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/profile/security" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/profile/support" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/profile/settings" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
