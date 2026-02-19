import { MainLayout } from "@/components/layout/MainLayout";
import { ReelsFeed } from "@/components/reels/ReelsFeed";
import { useReels, ReelData } from "@/hooks/useReels";
import { toast } from "sonner";
import { useState } from "react";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import { useExperiences } from "@/hooks/useExperiences";
import { CheckOutDialog } from "@/components/booking/CheckOutDialog";

const Home = () => {
  const { reels: liveReels, loading } = useReels("all");
  const [showAI, setShowAI] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelData | null>(null);
  const { messages, isLoading: aiLoading, sendMessage, clearMessages } = useCityPulseAI();
  const { experiences } = useExperiences("all");

  const handleSave = (id: string) => {
    toast.success("Added to saved!");
  };

  const handleBook = (id: string) => {
    const reel = liveReels.find(r => r.id === id);
    if (reel) setBookingReel(reel);
  };

  const handleSendMessage = (message: string) => {
    const context = {
      experiences: experiences,
      reels: liveReels,
    };
    sendMessage(message, "Current View", context);
  };

  const handleCloseAI = () => {
    setShowAI(false);
    clearMessages();
  };

  return (
    <MainLayout>
      {loading ? (
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent animate-spin rounded-full" />
        </div>
      ) : (
        <>
          <ReelsFeed reels={liveReels} onSave={handleSave} onBook={handleBook} />
          <AskZuruButton onClick={() => setShowAI(true)} isOpen={showAI} />
          {showAI && (
            <AIChatBox
              messages={messages}
              isLoading={aiLoading}
              onSendMessage={handleSendMessage}
              onClose={handleCloseAI}
              placeholder="Ask me anything about these reels..."
            />
          )}

          {bookingReel && (
            <CheckOutDialog
              experienceId={bookingReel.id}
              tripTitle={bookingReel.title}
              amount={bookingReel.price}
              open={!!bookingReel}
              onOpenChange={(open) => !open && setBookingReel(null)}
              trigger={<></>}
            />
          )}
        </>
      )}
    </MainLayout>
  );
};

export default Home;
