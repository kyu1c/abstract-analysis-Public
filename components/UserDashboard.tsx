"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { BookOpen, Highlighter, Tag, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Paper {
    id: string;
    title: string;
    created_at?: string;
}

interface Annotation {
    id: string;
    paper_id: string;
    tag_id: string;
    text_content: string;
    created_at?: any;
    deleted_at?: string;
}

interface TagData {
    id: string;
    label: string;
    color: string;
}

interface UserDashboardProps {
    userEmail: string;
    papers: Paper[];
    annotations: Annotation[];
    tags: Record<string, TagData>;
    readOnly?: boolean;
    onPaperClick?: (paperId: string) => void;
}

export function UserDashboard({ userEmail, papers, annotations, tags, readOnly = false, onPaperClick }: UserDashboardProps) {
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const router = useRouter();

    // Stats Calculation
    const stats = useMemo(() => {
        const totalPapers = papers.length;

        // Filter out orphaned annotations (paper doesn't exist) and soft-deleted ones
        const validAnnotations = annotations.filter(ann => {
            const paperExists = papers.some(p => p.id === ann.paper_id);
            const isNotDeleted = !ann.deleted_at;
            return paperExists && isNotDeleted;
        });

        const totalHighlights = validAnnotations.length;

        const tagCounts: Record<string, number> = {};
        validAnnotations.forEach(ann => {
            const label = tags[ann.tag_id]?.label;
            if (label) {
                tagCounts[label] = (tagCounts[label] || 0) + 1;
            }
        });

        let dominantTag = "None";
        let maxCount = 0;
        Object.entries(tagCounts).forEach(([label, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantTag = label;
            }
        });

        // Chart Data
        const chartData = Object.entries(tagCounts).map(([name, value]) => ({
            name,
            value,
            color: Object.values(tags).find(t => t.label === name)?.color || "#888"
        })).sort((a, b) => b.value - a.value);

        return {
            totalPapers,
            totalHighlights,
            dominantTag,
            chartData
        };
    }, [papers, annotations, tags]);

    // AI Analysis Handler
    const handleGenerateAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const recentAnns = annotations.slice(0, 20).map(ann => ({
                text_content: ann.text_content,
                tag_label: tags[ann.tag_id]?.label || "Unknown"
            }));

            const uniqueTags = Object.values(tags).map(t => ({ label: t.label }));

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tags: uniqueTags,
                    annotations: recentAnns
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setAiAnalysis(data.analysis);
        } catch (error: any) {
            console.error("Analysis failed:", error);
            alert("Failed to generate analysis: " + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Welcome back, {userEmail.split('@')[0]}</h1>
                    <p className="text-gray-500">Your Cognitive Mirror</p>
                </div>
                {!readOnly && (
                    <Button variant="outline" onClick={() => router.push("/")}>Back to Library</Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column: Stats & Charts */}
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Papers Analyzed</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-500" />
                                    {stats.totalPapers}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Highlights</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    <Highlighter className="h-5 w-5 text-yellow-500" />
                                    {stats.totalHighlights}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Dominant Tag</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-xl font-bold flex items-center gap-2 truncate" title={stats.dominantTag}>
                                    <Tag className="h-5 w-5 text-purple-500" />
                                    {stats.dominantTag}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Attention Distribution Chart */}
                    <Card className="h-[400px]">
                        <CardHeader>
                            <CardTitle>Attention Distribution</CardTitle>
                            <CardDescription>What do you focus on?</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[320px]">
                            {stats.chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    No data available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: AI & History */}
                <div className="space-y-6">
                    {/* AI Cognitive Report */}
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-900">
                                <Sparkles className="h-5 w-5 text-indigo-600" />
                                AI Cognitive Report
                            </CardTitle>
                            <CardDescription>Get insights into your reading style</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {aiAnalysis ? (
                                <div className="bg-white/80 p-4 rounded-lg border border-indigo-100 italic text-gray-700 leading-relaxed">
                                    "{aiAnalysis}"
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    Click below to analyze your recent highlights.
                                </div>
                            )}
                            <Button
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={handleGenerateAnalysis}
                                disabled={isAnalyzing || annotations.length === 0}
                            >
                                {isAnalyzing ? "Analyzing..." : "✨ Generate Analysis"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Recent Analysis History */}
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle>Recent Analysis History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Paper Title</TableHead>
                                        <TableHead className="text-right">Highlights</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {papers.length > 0 ? (
                                        papers.slice(0, 5).map((paper) => {
                                            const count = annotations.filter(a => a.paper_id === paper.id).length;
                                            return (
                                                <TableRow
                                                    key={paper.id}
                                                    className={readOnly && !onPaperClick ? "" : "cursor-pointer hover:bg-gray-50"}
                                                    onClick={() => {
                                                        if (onPaperClick) {
                                                            onPaperClick(paper.id);
                                                        } else if (!readOnly) {
                                                            router.push(`/paper/${paper.id}`);
                                                        }
                                                    }}
                                                >
                                                    <TableCell className="font-medium truncate max-w-[200px]">
                                                        {paper.title}
                                                    </TableCell>
                                                    <TableCell className="text-right">{count}</TableCell>
                                                    <TableCell>
                                                        {(!readOnly || onPaperClick) && <ArrowRight className="h-4 w-4 text-gray-400" />}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                                                No papers found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
