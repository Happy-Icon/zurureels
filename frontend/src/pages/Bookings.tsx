import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockBookings } from "@/data/mockReels";
import { Calendar, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BookingTab = "upcoming" | "completed";

const Bookings = () => {
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");

  const filteredBookings = mockBookings.filter((booking) => booking.status === activeTab);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4">
            <h1 className="text-2xl font-display font-semibold mb-4">My Bookings</h1>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-medium text-sm transition-all",
                  activeTab === "upcoming"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-medium text-sm transition-all",
                  activeTab === "completed"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No {activeTab} bookings</h3>
              <p className="text-muted-foreground text-sm">
                {activeTab === "upcoming"
                  ? "Start exploring and book your next adventure!"
                  : "Your past trips will appear here."}
              </p>
              {activeTab === "upcoming" && (
                <Button className="mt-4">Explore Destinations</Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const daysUntil = getDaysUntil(booking.checkIn);
                return (
                  <div
                    key={booking.id}
                    className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <div className="relative aspect-video">
                      <img
                        src={booking.imageUrl}
                        alt={booking.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {activeTab === "upcoming" && daysUntil > 0 && (
                        <Badge className="absolute top-3 right-3 bg-primary">
                          <Clock className="h-3 w-3 mr-1" />
                          {daysUntil} days to go
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">{booking.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {booking.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Check-in</p>
                          <p className="font-medium">{formatDate(booking.checkIn)}</p>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div>
                          <p className="text-muted-foreground">Check-out</p>
                          <p className="font-medium">{formatDate(booking.checkOut)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <p className="text-sm text-muted-foreground">Total paid</p>
                          <p className="text-lg font-semibold">${booking.totalPrice}</p>
                        </div>
                        <Button variant={activeTab === "upcoming" ? "default" : "outline"} size="sm">
                          {activeTab === "upcoming" ? "View Details" : "Book Again"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Bookings;
