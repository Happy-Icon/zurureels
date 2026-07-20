import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
    type: "email" | "phone" | "government_id";
    status: boolean; // true = verified, false = pending/unverified
    label: string;
}

export const VerificationBadge = ({ type, status, label }: VerificationBadgeProps) => {
    return (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        status ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                    )}
                >
                    {status ? (
                        <CheckCircle2 className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                </div>
                <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                        {status ? "Verified" : "Not verified"}
                    </p>
                </div>
            </div>
            {!status && (
                <Badge variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer">
                    Verify
                </Badge>
            )}
        </div>
    );
};
