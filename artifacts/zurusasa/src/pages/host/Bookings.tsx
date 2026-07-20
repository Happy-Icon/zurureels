import { MainLayout } from "@/components/layout/MainLayout";
import { HostBookings } from "@/components/host/dashboard/HostBookings";

const Bookings = () => {
    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-display font-semibold">Reservations</h1>
                                <p className="text-sm text-muted-foreground">Manage booking requests and upcoming trips</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <HostBookings />
                </div>
            </div>
        </MainLayout>
    );
};

export default Bookings;
