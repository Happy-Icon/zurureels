import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, MapPin, Video, Sparkles, ArrowRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export default function MobileOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Hide splash screen when onboarding mounts natively
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(console.error);
      StatusBar.setStyle({ style: Style.Dark }).catch(console.error);
    }
  }, []);

  const handleNext = () => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
    
    if (step < 2) {
      setStep(step + 1);
    } else {
      localStorage.setItem("hasSeenMobileOnboarding", "true");
      navigate("/");
    }
  };

  const slides = [
    {
      title: "Discover Hidden Gems",
      description: "Swipe through immersive short videos of the best stays and experiences.",
      icon: <Video className="h-12 w-12 text-orange-500 mb-4" />,
      color: "from-orange-500/20 to-orange-900/40"
    },
    {
      title: "Explore City Pulse",
      description: "See what's happening around you right now, live on the map.",
      icon: <MapPin className="h-12 w-12 text-blue-500 mb-4" />,
      color: "from-blue-500/20 to-blue-900/40"
    },
    {
      title: "Book Instantly",
      description: "Find the perfect spot and secure your booking with a single tap.",
      icon: <Sparkles className="h-12 w-12 text-purple-500 mb-4" />,
      color: "from-purple-500/20 to-purple-900/40"
    }
  ];

  return (
    <div className={`fixed inset-0 bg-black flex flex-col items-center justify-center transition-colors duration-700 bg-gradient-to-br ${slides[step].color}`}>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-12">
        <div className="bg-white/10 p-6 rounded-full backdrop-blur-xl mb-8 shadow-2xl border border-white/10 transition-transform duration-500 hover:scale-105">
          {slides[step].icon}
        </div>
        <h1 className="text-3xl font-display font-bold text-white mb-4 drop-shadow-md">
          {slides[step].title}
        </h1>
        <p className="text-white/80 text-lg leading-relaxed max-w-[280px]">
          {slides[step].description}
        </p>
      </div>

      <div className="w-full p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-orange-500" : "w-2 bg-white/30"
              }`}
            />
          ))}
        </div>
        
        <Button 
          onClick={handleNext}
          className="w-full h-14 rounded-full bg-white text-black hover:bg-white/90 text-lg font-bold shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all active:scale-95"
        >
          {step === 2 ? "Get Started" : "Continue"}
          {step === 2 ? <Play className="ml-2 h-5 w-5 fill-current" /> : <ArrowRight className="ml-2 h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
