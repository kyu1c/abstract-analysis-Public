import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Highlighter, Activity, Tag } from "lucide-react";

interface AdminStats {
    totalParticipants: number;
    totalAnnotations: number;
    totalPapers: number;
    avgTagsPerPaper: number;
    mostUsedTag: string;
}

export function AdminStatsCards({ stats, onManageUsers }: { stats: AdminStats, onManageUsers?: () => void }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-2xl font-bold">{stats.totalParticipants}</div>
                            <p className="text-xs text-muted-foreground">Unique users</p>
                        </div>
                        {onManageUsers && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onManageUsers}>
                                Manage
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Annotations</CardTitle>
                    <Highlighter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalAnnotations}</div>
                    <p className="text-xs text-muted-foreground">Across all papers</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Papers</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalPapers}</div>
                    <p className="text-xs text-muted-foreground">Available for analysis</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Tags / Paper</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.avgTagsPerPaper.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Cognitive complexity</p>
                </CardContent>
            </Card>
        </div>
    );
}
