import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import { Radio, Users, Settings, Activity } from "lucide-react";

const AdminDashboard = () => {
    return (
        <MainLayout>
            <div className="min-h-screen bg-background p-6 md:p-10 pt-24 md:pt-10">
                <div className="max-w-5xl mx-auto space-y-8">

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-display font-semibold text-foreground tracking-tight">Admin Dashboard</h1>
                            <p className="text-muted-foreground mt-2">Manage your platform and communications.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Quick Action Cards */}
                        <Link to="/admin/broadcasts" className="glass p-6 rounded-2xl border border-border/50 hover:bg-secondary/50 transition-colors flex flex-col gap-4 group">
                            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Radio className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Broadcasts</h3>
                                <p className="text-sm text-muted-foreground mt-1">Send marketing emails and newsletters to your audience.</p>
                            </div>
                        </Link>

                        <div className="glass p-6 rounded-2xl border border-border/50 opacity-50 flex flex-col gap-4">
                            <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Users</h3>
                                <p className="text-sm text-muted-foreground mt-1">Manage users and roles. (Coming Soon)</p>
                            </div>
                        </div>

                        <div className="glass p-6 rounded-2xl border border-border/50 opacity-50 flex flex-col gap-4">
                            <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Analytics</h3>
                                <p className="text-sm text-muted-foreground mt-1">View platform metrics. (Coming Soon)</p>
                            </div>
                        </div>

                        <div className="glass p-6 rounded-2xl border border-border/50 opacity-50 flex flex-col gap-4">
                            <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                                <Settings className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Settings</h3>
                                <p className="text-sm text-muted-foreground mt-1">Configure app parameters. (Coming Soon)</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
};

export default AdminDashboard;
