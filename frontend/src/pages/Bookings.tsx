import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBookings } from "@/hooks/useBookings";
import { Calendar, MapPin, Clock, Loader2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type BookingTab = "upcoming" | "history";

const Bookings = () => {
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const { bookings, loading, cancelBooking } = useBookings("guest");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === "upcoming") {
      return booking.status === "paid" || booking.status === "pending";
    } else {
      return booking.status === "completed" || booking.status === "cancelled";
    }
  });

  const handleCancel = async (id: string) => {
    const res = await cancelBooking(id);
    if (res.success) {
      toast.success("Booking cancelled successfully");
    } else {
      toast.error("Failed to cancel booking");
    }
    setCancellingId(null);
  };

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
                onClick={() => setActiveTab("history")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-medium text-sm transition-all",
                  activeTab === "history"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                History
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">Fetching your bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No {activeTab} trips</h3>
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
                const daysUntil = booking.check_in ? getDaysUntil(booking.check_in) : 0;
                const isCancelled = booking.status === "cancelled";

                return (
                  <div
                    key={booking.id}
                    className={cn(
                      "rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors",
                      isCancelled && "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className="relative aspect-video">
                      <img
                        src={booking.experience?.image_url || "/placeholder.svg"}
                        alt={booking.trip_title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {activeTab === "upcoming" && daysUntil > 0 && (
                        <Badge className="absolute top-3 right-3 bg-primary">
                          <Clock className="h-3 w-3 mr-1" />
                          {daysUntil} days to go
                        </Badge>
                      )}
                      {isCancelled && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Badge variant="destructive" className="px-4 py-1 text-sm font-bold">
                            CANCELLED
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{booking.trip_title}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {booking.experience?.location || "Location TBD"}
                          </p>
                        </div>
                        {activeTab === "upcoming" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                <XCircle className="h-5 w-5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will cancel your reservation. Refunds are processed automatically based on the coastal policy.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No, keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancel(booking.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Yes, cancel booking
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Check-in</p>
                          <p className="font-medium">{booking.check_in ? formatDate(booking.check_in) : "---"}</p>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div>
                          <p className="text-muted-foreground">Check-out</p>
                          <p className="font-medium">{booking.check_out ? formatDate(booking.check_out) : "---"}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <p className="text-sm text-muted-foreground">Total paid</p>
                          <p className="text-lg font-semibold">KES {booking.amount.toLocaleString()}</p>
                        </div>
                        <Button variant={isCancelled ? "outline" : "default"} size="sm">
                          {isCancelled || activeTab === "history" ? "Book Again" : "View Details"}
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
