
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Construction } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const ComingSoon = () => {
    const location = useLocation();
    const title = location.pathname.split("/").pop()?.replace("-", " ");

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="p-4 border-b border-border">
                    <Link to="/profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="capitalize">{title || "Back"}</span>
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                        <Construction className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-2xl font-display font-semibold mb-2 capitalize">
                        {title} Coming Soon
                    </h1>
                    <p className="text-muted-foreground max-w-sm">
                        We are working hard to bring you this feature. Stay tuned for updates!
                    </p>
                </div>
            </div>
        </MainLayout>
    );
};
