import { MainLayout } from "@/components/layout/MainLayout";
import { ReelsFeed } from "@/components/reels/ReelsFeed";
import { mockReels } from "@/data/mockReels";
import { toast } from "sonner";

const Home = () => {
  const handleSave = (id: string) => {
    toast.success("Added to saved!");
  };

  const handleBook = (id: string) => {
    toast.info("Opening booking details...");
  };

  return (
    <MainLayout>
      <ReelsFeed reels={mockReels} onSave={handleSave} onBook={handleBook} />
    </MainLayout>
  );
};

export default Home;
