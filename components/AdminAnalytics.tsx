"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { groupTags } from "@/utils/tag-grouping";
import { Loader2, RefreshCw, Filter } from "lucide-react";

interface AdminAnalyticsProps {
    users: any[];
    papers: any[];
    annotations: any[];
    tags: Record<string, any>;
    sessions?: any[]; // Optional for now, will be fetched if not provided
}

export function AdminAnalytics({ users, papers, annotations, tags, sessions: propSessions }: AdminAnalyticsProps) {
    const [groupedTags, setGroupedTags] = useState<any[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [flexFilter, setFlexFilter] = useState<'Summary' | 'Detailed' | 'Created' | 'Deleted'>('Summary');
    const [sessions, setSessions] = useState<any[]>(propSessions || []);

    // 3. Flexibility (Leaderboard)
    const leaderboard = useMemo(() => {
        return users.map(user => {
            const userAnns = annotations.filter(a => a.user_id === user.id);
            const activeCount = userAnns.filter(a => !a.deleted_at).length;
            const deletedCount = userAnns.filter(a => a.deleted_at).length;
            const totalActions = activeCount + deletedCount;

            const timestamps = userAnns
                .map(a => {
                    const t = a.updated_at || a.created_at;
                    return t ? new Date(t).getTime() : 0;
                })
                .filter(t => t > 0);

            const lastActive = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toLocaleDateString() : "-";
            const signupDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : "-";

            // Calculate unique papers annotated
            const uniquePapers = new Set(userAnns.map(a => a.paper_id));
            const paperCount = uniquePapers.size;

            return {
                name: user.email.split('@')[0],
                totalActions,
                activeCount,
                deletedCount,
                lastActive,
                signupDate,
                paperCount
            };
        }).sort((a, b) => b.totalActions - a.totalActions);
    }, [users, annotations]);

    // 1. Classification Trends (AI Grouping)
    useEffect(() => {
        const analyzeTags = async () => {
            setLoadingGroups(true);
            try {
                const uniqueLabels = Array.from(new Set(Object.values(tags).map((t: any) => t.label)));

                // Call AI API
                const response = await fetch("/api/group-tags", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tags: uniqueLabels })
                });

                const data = await response.json();

                if (data.groups) {
                    const groupCounts = data.groups.map((group: any) => {
                        let count = 0;
                        group.tags.forEach((tagName: string) => {
                            const tagIds = Object.values(tags).filter((t: any) => t.label === tagName).map((t: any) => t.id);
                            count += annotations.filter((a: any) => tagIds.includes(a.tag_id)).length;
                        });
                        return { name: group.name, value: count, tags: group.tags };
                    });
                    setGroupedTags(groupCounts.sort((a: any, b: any) => b.value - a.value));
                } else {
                    // Fallback to local grouping if API fails or returns no groups
                    console.warn("AI grouping failed, falling back to local logic");
                    const groups = groupTags(uniqueLabels);
                    const groupCounts = groups.map(group => {
                        let count = 0;
                        group.tags.forEach(tagName => {
                            const tagIds = Object.values(tags).filter((t: any) => t.label === tagName).map((t: any) => t.id);
                            count += annotations.filter((a: any) => tagIds.includes(a.tag_id)).length;
                        });
                        return { name: group.name, value: count, tags: group.tags };
                    });
                    setGroupedTags(groupCounts.sort((a, b) => b.value - a.value));
                }

            } catch (error) {
                console.error("Failed to group tags:", error);
                // Fallback
                const uniqueLabels = Array.from(new Set(Object.values(tags).map((t: any) => t.label)));
                const groups = groupTags(uniqueLabels);
                const groupCounts = groups.map(group => {
                    let count = 0;
                    group.tags.forEach(tagName => {
                        const tagIds = Object.values(tags).filter((t: any) => t.label === tagName).map((t: any) => t.id);
                        count += annotations.filter((a: any) => tagIds.includes(a.tag_id)).length;
                    });
                    return { name: group.name, value: count, tags: group.tags };
                });
                setGroupedTags(groupCounts.sort((a, b) => b.value - a.value));
            } finally {
                setLoadingGroups(false);
            }
        };

        if (Object.keys(tags).length > 0) {
            analyzeTags();
        }
    }, [tags, annotations]);

    // Fetch sessions if not provided
    useEffect(() => {
        const fetchSessions = async () => {
            if (propSessions) return; // Already provided

            try {
                const { collection, getDocs } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');
                const sessionsSnap = await getDocs(collection(db, 'paper_sessions'));
                const sessionsData = sessionsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setSessions(sessionsData);
            } catch (error) {
                console.error('[Analytics] Error fetching sessions:', error);
            }
        };

        fetchSessions();
    }, [propSessions]);

    // 2. Difficulty/Fatigue (Time Spent) - Using Session Data
    const timeData = useMemo(() => {
        // Group papers by user, then sort each user's papers by order
        const userPapersMap = new Map<string, any[]>();

        papers.forEach(paper => {
            if (!userPapersMap.has(paper.user_id)) {
                userPapersMap.set(paper.user_id, []);
            }
            userPapersMap.get(paper.user_id)!.push(paper);
        });

        // Sort each user's papers by order
        userPapersMap.forEach((userPapers, userId) => {
            userPapers.sort((a, b) => (a.order || 0) - (b.order || 0));
        });

        // Find the maximum number of papers any user has
        let maxPapers = 0;
        userPapersMap.forEach(userPapers => {
            maxPapers = Math.max(maxPapers, userPapers.length);
        });

        // Create data points for each paper position (1, 2, 3, ...)
        const dataPoints: any[] = [];
        for (let paperIndex = 0; paperIndex < maxPapers; paperIndex++) {
            const point: any = {
                sequence: paperIndex + 1
            };

            // For each user, get their Nth paper (if they have one)
            users.forEach(user => {
                const userName = user.email.split('@')[0];
                const userPapers = userPapersMap.get(user.id) || [];

                if (paperIndex < userPapers.length) {
                    const paper = userPapers[paperIndex];

                    // Store title for tooltip
                    point[`${userName}_title`] = paper.title.substring(0, 20) + "...";

                    // Calculate total time from sessions
                    const paperSessions = sessions.filter(s =>
                        s.user_id === user.id && s.paper_id === paper.id
                    );

                    if (paperSessions.length > 0) {
                        const totalSeconds = paperSessions.reduce((sum, session) => {
                            return sum + (session.duration_seconds || 0);
                        }, 0);

                        // Debug log
                        if (user.email.includes("test") || user.email.includes("unikyu")) {
                            console.log(`[Analytics] User: ${userName}, Paper #${paperIndex + 1}, Sessions: ${paperSessions.length}, Seconds: ${totalSeconds}`);
                        }

                        if (totalSeconds >= 0 && totalSeconds < 86400) { // Allow up to 24 hours (86400 seconds)
                            point[userName] = totalSeconds;
                        } else {
                            point[userName] = 1;
                        }

                        // Ensure 0 becomes at least something visible
                        if (point[userName] === 0) point[userName] = 1;
                    }
                }
            });

            dataPoints.push(point);
        }

        return dataPoints;
    }, [papers, users, sessions]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
    const SKELETON_COLOR = "#e5e7eb"; // Gray-200
    const SKELETON_TEXT = "#9ca3af"; // Gray-400

    // Skeleton Data
    const skeletonGroupedTags = [
        { name: "Group A", value: 40, tags: ["Tag 1", "Tag 2"] },
        { name: "Group B", value: 30, tags: ["Tag 3"] },
        { name: "Group C", value: 20, tags: ["Tag 4", "Tag 5"] },
    ];

    const skeletonLeaderboard = [
        { name: "User A", totalActions: 15, activeCount: 10, deletedCount: 5, lastActive: "-", signupDate: "-", paperCount: 2 },
        { name: "User B", totalActions: 10, activeCount: 8, deletedCount: 2, lastActive: "-", signupDate: "-", paperCount: 1 },
        { name: "User C", totalActions: 5, activeCount: 5, deletedCount: 0, lastActive: "-", signupDate: "-", paperCount: 0 },
    ];

    const skeletonTimeData = [
        { sequence: 1, title: "Paper 1", "User A": 5, "User B": 8 },
        { sequence: 2, title: "Paper 2", "User A": 12, "User B": 10 },
        { sequence: 3, title: "Paper 3", "User A": 8, "User B": 6 },
    ];

    const isDataEmpty = annotations.length === 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Classification Trends */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            Classification Trends
                            <Button size="sm" variant="ghost" disabled={loadingGroups}>
                                {loadingGroups ? <Loader2 className="animate-spin" /> : <RefreshCw size={16} />}
                            </Button>
                        </CardTitle>
                        <CardDescription>Semantic grouping of user tags {isDataEmpty && "(Preview)"}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col">
                        {(groupedTags.length > 0 && !isDataEmpty) || isDataEmpty ? (
                            <div className="flex flex-1">
                                <div className="w-1/2 h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={!isDataEmpty && groupedTags.length > 0 ? groupedTags : skeletonGroupedTags}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={70}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {(!isDataEmpty && groupedTags.length > 0 ? groupedTags : skeletonGroupedTags).map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={!isDataEmpty && groupedTags.length > 0 ? COLORS[index % COLORS.length] : SKELETON_COLOR}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-1/2 h-full overflow-y-auto text-xs space-y-2 pl-2 border-l">
                                    {(!isDataEmpty && groupedTags.length > 0 ? groupedTags : skeletonGroupedTags).map((group, i) => (
                                        <div key={i} className="flex flex-col">
                                            <div className="flex items-center gap-2 font-semibold">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: !isDataEmpty && groupedTags.length > 0 ? COLORS[i % COLORS.length] : SKELETON_COLOR }}
                                                />
                                                <span style={{ color: !isDataEmpty && groupedTags.length > 0 ? 'inherit' : SKELETON_TEXT }}>
                                                    {group.name} ({group.value})
                                                </span>
                                            </div>
                                            <div className="pl-5 text-gray-500">
                                                {group.tags.join(", ")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Flexibility Leaderboard */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-1">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Flexibility Leaderboard</CardTitle>
                                <CardDescription>User activity and modifications {isDataEmpty && "(Preview)"}</CardDescription>
                            </div>
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
                                {['Summary', 'Detailed', 'Created', 'Deleted'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFlexFilter(f as any)}
                                        className={`px-2 py-1 text-xs rounded-sm transition-colors ${flexFilter === f ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {flexFilter === 'Summary' ? (
                            <div className="overflow-y-auto max-h-[300px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 w-[20%]">user</th>
                                            <th className="px-4 py-2 w-[15%]">Papers</th>
                                            <th className="px-4 py-2 w-[15%]">Total Actions</th>
                                            <th className="px-4 py-2 w-[25%]">Created / Deleted</th>
                                            <th className="px-4 py-2 w-[25%]">Sign-up</th>
                                        </tr>
                                    </thead>
                                    <tbody className={users.length === 0 ? "text-gray-400" : ""}>
                                        {(users.length > 0 ? leaderboard : skeletonLeaderboard).map((user, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="px-4 py-2 font-medium">{user.name}</td>
                                                <td className="px-4 py-2">{user.paperCount}</td>
                                                <td className="px-4 py-2">{user.totalActions}</td>
                                                <td className="px-4 py-2 text-gray-500">{user.activeCount} / {user.deletedCount}</td>
                                                <td className="px-4 py-2">{user.signupDate || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={!isDataEmpty && leaderboard.length > 0 ? leaderboard : skeletonLeaderboard}
                                        layout="vertical"
                                        margin={{ left: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Legend />
                                        {(flexFilter === 'Detailed' || flexFilter === 'Created') && (
                                            <Bar
                                                dataKey="activeCount"
                                                name="Created"
                                                stackId="a"
                                                fill={!isDataEmpty && leaderboard.length > 0 ? "#3B82F6" : SKELETON_COLOR}
                                                radius={[0, 4, 4, 0]}
                                            />
                                        )}
                                        {(flexFilter === 'Detailed' || flexFilter === 'Deleted') && (
                                            <Bar
                                                dataKey="deletedCount"
                                                name="Deleted"
                                                stackId="a"
                                                fill={!isDataEmpty && leaderboard.length > 0 ? "#EF4444" : "#d1d5db"}
                                                radius={[0, 4, 4, 0]}
                                            />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Difficulty/Fatigue Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Difficulty / Fatigue Analysis</CardTitle>
                    <CardDescription>Time spent per paper (sequence order) {isDataEmpty && "(Preview)"}</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={!isDataEmpty && timeData.length > 0 ? timeData : skeletonTimeData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sequence" label={{ value: 'Paper Sequence', position: 'insideBottom', offset: -5 }} />
                            <YAxis
                                label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
                                domain={[0, 'auto']}
                                allowDataOverflow={false}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white border p-3 rounded shadow-lg text-xs">
                                                <p className="font-bold mb-1">Paper {label}</p>
                                                {payload.map((p: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-2 mb-1">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                        <span className="font-semibold">{p.name}:</span>
                                                        <span>{p.value} sec</span>
                                                        <span className="text-gray-400 italic">({p.payload[`${p.name}_title`] || "Untitled"})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend />
                            {(!isDataEmpty && users.length > 0 ? users : [{ id: 's1', email: 'User A' }, { id: 's2', email: 'User B' }]).map((user, i) => (
                                <Line
                                    key={user.id}
                                    type="monotone"
                                    dataKey={user.email.split('@')[0] || user.email}
                                    stroke={!isDataEmpty && users.length > 0 ? COLORS[i % COLORS.length] : SKELETON_COLOR}
                                    strokeWidth={2}
                                    activeDot={{ r: 6 }}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
