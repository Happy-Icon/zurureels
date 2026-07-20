import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Search, Calendar, CreditCard, User, Shield, Phone, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const Support = () => {
    // Mock Data
    const recentTickets = [
        { id: "T-10234", subject: "Refund request for cancelled trip", date: "Jan 15, 2024", status: "Open" },
        { id: "T-09982", subject: "Question about hosting fees", date: "Dec 12, 2023", status: "Resolved" },
        { id: "T-09112", subject: "Unable to update profile photo", date: "Nov 28, 2023", status: "Resolved" },
    ];

    const topics = [
        { icon: Calendar, label: "Bookings", desc: "Manage trips and reservations" },
        { icon: CreditCard, label: "Payments", desc: "Refunds, taxes, and payouts" },
        { icon: User, label: "Account", desc: "Profile settings and security" },
        { icon: Shield, label: "Safety", desc: "Trust and safety concerns" },
    ];

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">

                {/* Header */}
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <Link to="/profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                            <span>Back to Profile</span>
                        </Link>
                        <h1 className="font-semibold text-lg hidden md:block">Help & Support</h1>
                    </div>
                </div>

                <div className="p-4 max-w-4xl mx-auto space-y-8">

                    {/* Hero / Search */}
                    <div className="text-center space-y-6 py-8">
                        <h1 className="text-3xl font-display font-bold">How can we help you today?</h1>
                        <div className="max-w-md mx-auto relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                className="pl-10 h-12 text-lg shadow-sm"
                                placeholder="Search for answers..."
                            />
                        </div>
                    </div>

                    {/* Topic Grid */}
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Browse by Topic</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {topics.map((topic) => (
                                <Card key={topic.label} className="hover:bg-accent/50 transition-colors cursor-pointer border-muted">
                                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <topic.icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground">{topic.label}</h3>
                                            <p className="text-xs text-muted-foreground mt-1">{topic.desc}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Live Support */}
                    <div className="grid md:grid-cols-2 gap-6 p-6 bg-muted/30 rounded-xl border">
                        <div>
                            <h2 className="text-lg font-semibold mb-2">Need to talk to someone?</h2>
                            <p className="text-muted-foreground mb-6">Our support team is available 24/7 to assist you.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 flex-1">
                                    <MessageCircle className="h-5 w-5" />
                                    Chat on WhatsApp
                                </Button>
                                <Button variant="outline" className="gap-2 flex-1">
                                    <Phone className="h-4 w-4" />
                                    Call Support
                                </Button>
                            </div>
                        </div>
                        <div className="hidden md:flex items-center justify-center p-4 bg-background rounded-lg border border-dashed">
                            <p className="text-sm text-center text-muted-foreground">
                                "Fastest way to get help is via WhatsApp. Average response time: &lt; 2 mins"
                            </p>
                        </div>
                    </div>

                    {/* Ticket History */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Your Support Requests</h2>
                            <Button variant="link" className="text-primary h-auto p-0">View All</Button>
                        </div>

                        <div className="border rounded-lg overflow-hidden bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ticket ID</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead className="hidden md:table-cell">Date</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentTickets.map((ticket) => (
                                        <TableRow key={ticket.id}>
                                            <TableCell className="font-medium">{ticket.id}</TableCell>
                                            <TableCell>{ticket.subject}</TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground">{ticket.date}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant={ticket.status === "Open" ? "default" : "secondary"}
                                                    className={ticket.status === "Resolved" ? "bg-green-100 text-green-700 hover:bg-green-100 border-none" : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-none"}
                                                >
                                                    {ticket.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
};

export default Support;
