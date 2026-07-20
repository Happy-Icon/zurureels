import { Card, CardContent } from "@/components/ui/card";

interface HostStatsProps {
    totalReels: number;
    totalViews: number;
    bookings: number;
}

export const HostStats = ({ totalReels, totalViews, bookings }: HostStatsProps) => {
    return (
        <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-semibold">{totalReels}</p>
                    <p className="text-xs text-muted-foreground">Reels</p>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-semibold">
                        {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews}
                    </p>
                    <p className="text-xs text-muted-foreground">Views</p>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-semibold">{bookings}</p>
                    <p className="text-xs text-muted-foreground">Bookings</p>
                </CardContent>
            </Card>
        </div>
    );
};
