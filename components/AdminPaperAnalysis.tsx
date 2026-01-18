import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Paper {
    id: string;
    title: string;
    abstract_text: string;
    user_id: string;
}

interface Annotation {
    id: string;
    paper_id: string;
    tag_id: string;
    text_content: string;
    user_id: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;
}

interface Tag {
    id: string;
    label: string;
    color: string;
}

interface AdminPaperAnalysisProps {
    papers: Paper[];
    annotations: Annotation[];
    tags: Record<string, Tag>;
    users: any[]; // Pass users to map IDs to names
}

export function AdminPaperAnalysis({ papers, annotations, tags, users }: AdminPaperAnalysisProps) {
    const [viewMode, setViewMode] = useState<"paper" | "user">("paper");
    const [selectedPaperTitle, setSelectedPaperTitle] = useState<string>("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [showOnlyAnalyzed, setShowOnlyAnalyzed] = useState(true);

    // AI Grouping State
    const [groupedTags, setGroupedTags] = useState<any[]>([]);
    const [tagToGroupMap, setTagToGroupMap] = useState<Record<string, string>>({});
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Filter papers based on toggle and deduplicate by title
    const uniquePapers = useMemo(() => {
        // 1. Get all relevant papers first
        let relevantPapers = papers;
        if (showOnlyAnalyzed) {
            const activeAnnotations = annotations.filter(a => !a.deleted_at);
            const analyzedPaperIds = new Set(activeAnnotations.map(a => a.paper_id));
            relevantPapers = papers.filter(p => analyzedPaperIds.has(p.id));
        }

        // 2. Deduplicate by title
        const uniqueMap = new Map();
        relevantPapers.forEach(p => {
            if (!uniqueMap.has(p.title)) {
                uniqueMap.set(p.title, p);
            }
        });

        return Array.from(uniqueMap.values());
    }, [papers, annotations, showOnlyAnalyzed]);

    // Update selected paper if current selection is invalid or empty
    if ((!selectedPaperTitle || !uniquePapers.find(p => p.title === selectedPaperTitle)) && uniquePapers.length > 0) {
        setSelectedPaperTitle(uniquePapers[0].title);
    }

    // Update selected user if invalid
    if ((!selectedUserId || !users.find(u => u.id === selectedUserId)) && users.length > 0) {
        setSelectedUserId(users[0].id);
    }

    // AI Tag Grouping Effect
    useEffect(() => {
        const fetchGroupedTags = async () => {
            if (viewMode !== 'paper' || !selectedPaperTitle) return;

            setLoadingGroups(true);
            try {
                // Find annotations for this paper
                const matchingPaperIds = new Set(papers
                    .filter(p => p.title === selectedPaperTitle)
                    .map(p => p.id));
                const paperAnns = annotations.filter(a => matchingPaperIds.has(a.paper_id));

                // Get unique tags used in this paper
                const usedTagIds = new Set(paperAnns.map(a => a.tag_id));
                const usedTagLabels = Array.from(usedTagIds).map(id => tags[id]?.label).filter(Boolean);

                if (usedTagLabels.length === 0) {
                    setGroupedTags([]);
                    return;
                }

                // Call API
                const response = await fetch("/api/group-tags", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tags: usedTagLabels })
                });

                const data = await response.json();

                if (data.groups) {
                    const newTagToGroupMap: Record<string, string> = {};
                    const groupCounts = data.groups.map((group: any) => {
                        let count = 0;
                        group.tags.forEach((tagName: string) => {
                            newTagToGroupMap[tagName] = group.name;
                            const tagIds = Object.values(tags).filter((t: any) => t.label === tagName).map((t: any) => t.id);
                            count += paperAnns.filter((a: any) => tagIds.includes(a.tag_id)).length;
                        });
                        return { name: group.name, value: count, tags: group.tags };
                    });
                    setTagToGroupMap(newTagToGroupMap);
                    setGroupedTags(groupCounts.sort((a: any, b: any) => b.value - a.value));
                } else {
                    // Fallback: just show top 5 individual tags
                    setTagToGroupMap({});
                    const tagCounts: Record<string, number> = {};
                    paperAnns.forEach(ann => {
                        const tagLabel = tags[ann.tag_id]?.label || "Unknown";
                        tagCounts[tagLabel] = (tagCounts[tagLabel] || 0) + 1;
                    });
                    const sorted = Object.entries(tagCounts)
                        .map(([name, count]) => ({ name, value: count }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 6);
                    setGroupedTags(sorted);
                }

            } catch (error) {
                console.error("Failed to group tags:", error);
                setGroupedTags([]);
                setTagToGroupMap({});
            } finally {
                setLoadingGroups(false);
            }
        };

        fetchGroupedTags();
    }, [selectedPaperTitle, viewMode, papers, annotations, tags]);


    const analysisData = useMemo(() => {
        if (viewMode === 'paper' && !selectedPaperTitle) return null;
        if (viewMode === 'user' && !selectedUserId) return null;

        let paperAnns: Annotation[] = [];

        if (viewMode === 'paper') {
            const matchingPaperIds = new Set(papers
                .filter(p => p.title === selectedPaperTitle)
                .map(p => p.id));
            paperAnns = annotations.filter(a => matchingPaperIds.has(a.paper_id) && !a.deleted_at);
        } else {
            // User Mode: Filter annotations for this user
            // And also filter by selected paper if we want per-paper breakdown? 
            // The request implies "User View" -> maybe see all their work or select a paper?
            // Let's stick to "Select User -> Select Paper" flow for consistency, 
            // OR just aggregate all their work? 
            // "Paper view itself... select whether to see analysis per paper or per user"
            // If "Per User", likely means "See this user's analysis for THIS paper" or "All papers"?
            // Let's assume "Select User -> Select Paper" to compare.
            // Actually, let's make it simple: Select User -> Show their top tags and papers.
            // But the component is "PaperAnalysis". 
            // Let's implement: Select User -> Select Paper (filtered for them).

            // For now, let's just use the SAME paper selector but filter data by user?
            // No, the user said "User view... select paper".

            // Let's go with:
            // Mode Paper: Select Paper -> Aggregated Data (Grouped Tags)
            // Mode User: Select User -> Select Paper -> Individual Data (Raw Tags)

            if (selectedPaperTitle) {
                const matchingPaperIds = new Set(papers
                    .filter(p => p.title === selectedPaperTitle && p.user_id === selectedUserId)
                    .map(p => p.id));
                paperAnns = annotations.filter(a => matchingPaperIds.has(a.paper_id) && a.user_id === selectedUserId && !a.deleted_at);
            }
        }

        // 1. Tag Distribution
        let chartData;
        if (viewMode === 'paper') {
            // Use AI Grouped Tags
            chartData = groupedTags.map(g => ({
                name: g.name,
                count: g.value,
                color: "#8884d8" // Generic color for groups, or map to a palette
            }));
        } else {
            // Raw Tags for User
            const tagCounts: Record<string, number> = {};
            paperAnns.forEach(ann => {
                const tagLabel = tags[ann.tag_id]?.label || "Unknown";
                tagCounts[tagLabel] = (tagCounts[tagLabel] || 0) + 1;
            });
            chartData = Object.entries(tagCounts).map(([name, count]) => ({
                name,
                count,
                color: Object.values(tags).find(t => t.label === name)?.color || "#8884d8"
            })).sort((a, b) => b.count - a.count);
        }

        // 2. Consensus List (Most frequent text segments)
        const textCounts: Record<string, number> = {};
        paperAnns.forEach(ann => {
            const text = ann.text_content.trim();
            if (text) {
                textCounts[text] = (textCounts[text] || 0) + 1;
            }
        });

        const consensusList = Object.entries(textCounts)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 3. Detailed Annotations List
        const detailedList = paperAnns.map(ann => {
            const user = users.find(u => u.id === ann.user_id);
            const tag = tags[ann.tag_id];
            const tagLabel = tag?.label || "Unknown";
            return {
                id: ann.id,
                user: user ? user.email.split('@')[0] : "Unknown",
                tagLabel: tagLabel,
                group: viewMode === 'paper' ? (tagToGroupMap[tagLabel] || "Uncategorized") : "-",
                tagColor: tag?.color || "#ccc",
                text: ann.text_content,
                created: ann.created_at ? new Date(ann.created_at).toLocaleDateString() : "-"
            };
        }).sort((a, b) => a.user.localeCompare(b.user));

        return { chartData, consensusList, detailedList, totalAnnotations: paperAnns.length };
    }, [selectedPaperTitle, selectedUserId, viewMode, papers, annotations, tags, users, groupedTags, tagToGroupMap]);

    if (uniquePapers.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500 space-y-4">
                <p>No papers available for analysis.</p>
                {papers.length > 0 && showOnlyAnalyzed && (
                    <div className="flex items-center justify-center gap-2">
                        <Switch id="show-all-empty" checked={showOnlyAnalyzed} onCheckedChange={setShowOnlyAnalyzed} />
                        <Label htmlFor="show-all-empty">Show only analyzed papers</Label>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                {/* View Mode Toggle */}
                <div className="flex justify-center">
                    <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                        <button
                            onClick={() => setViewMode("paper")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === "paper" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                                }`}
                        >
                            Analyze by Paper
                        </button>
                        <button
                            onClick={() => setViewMode("user")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === "user" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                                }`}
                        >
                            Analyze by User
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg border">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        {viewMode === 'user' && (
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <span className="font-medium whitespace-nowrap text-sm">User:</span>
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                    <SelectTrigger className="w-full md:w-[200px]">
                                        <SelectValue placeholder="Select User" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.email.split('@')[0]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="font-medium whitespace-nowrap text-sm">Paper:</span>
                            <Select value={selectedPaperTitle} onValueChange={setSelectedPaperTitle}>
                                <SelectTrigger className="w-full md:w-[300px]">
                                    <SelectValue placeholder="Select Paper" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniquePapers.map(paper => (
                                        <SelectItem key={paper.id} value={paper.title}>
                                            {paper.title.substring(0, 40)}{paper.title.length > 40 ? "..." : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id="show-analyzed"
                            checked={showOnlyAnalyzed}
                            onCheckedChange={setShowOnlyAnalyzed}
                        />
                        <div className="flex flex-col">
                            <Label htmlFor="show-analyzed" className="cursor-pointer">Analyzed Only</Label>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Tag Distribution Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {viewMode === 'paper' ? "Grouped Tag Distribution (AI)" : "User Tag Distribution"}
                        </CardTitle>
                        <CardDescription>
                            {viewMode === 'paper'
                                ? "Semantic grouping of all user tags (Max 6 groups)"
                                : "Tags used by this user"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loadingGroups && viewMode === 'paper' ? (
                            <div className="h-full flex items-center justify-center text-gray-400 animate-pulse">
                                Grouping tags with AI...
                            </div>
                        ) : analysisData?.chartData && analysisData.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analysisData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border rounded shadow-sm text-sm">
                                                    <p className="font-bold">{data.name}</p>
                                                    <p>Count: {data.count}</p>
                                                    {data.tags && (
                                                        <p className="text-xs text-gray-500 mt-1 max-w-[200px] break-words">
                                                            Includes: {data.tags.join(", ")}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {analysisData.chartData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color || "#8884d8"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                No annotations yet
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Consensus List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Highlights</CardTitle>
                        <CardDescription>
                            {viewMode === 'paper' ? "Top highlighted segments by all users" : "Highlights by this user"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto">
                            {analysisData?.consensusList && analysisData.consensusList.length > 0 ? (
                                analysisData.consensusList.map((item, index) => (
                                    <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                                        <div className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs min-w-[24px] text-center">
                                            {item.count}x
                                        </div>
                                        <p className="text-sm text-gray-700 italic">"{item.text}"</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-400 py-8">
                                    No data available
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Annotations Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Annotations</CardTitle>
                    <CardDescription>Individual highlights</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2">User</th>
                                    <th className="px-4 py-2">Group</th>
                                    <th className="px-4 py-2">Tag</th>
                                    <th className="px-4 py-2">Highlighted Text</th>
                                    <th className="px-4 py-2">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysisData?.detailedList && analysisData.detailedList.length > 0 ? (
                                    analysisData.detailedList.map((item) => (
                                        <tr key={item.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium">{item.user}</td>
                                            <td className="px-4 py-2 text-gray-500 text-xs">{item.group}</td>
                                            <td className="px-4 py-2">
                                                <span
                                                    className="px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                                                    style={{ backgroundColor: item.tagColor }}
                                                >
                                                    {item.tagLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 italic text-gray-600 max-w-md truncate" title={item.text}>
                                                "{item.text}"
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">{item.created}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                            No annotations found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
