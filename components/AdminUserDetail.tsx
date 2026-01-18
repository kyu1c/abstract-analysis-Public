import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { X, MessageSquare } from "lucide-react";
import { UserDashboard } from "./UserDashboard";
import { Highlighter } from "./Highlighter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface UserData {
    id: string;
    email: string;
    role: string;
    admin_notes?: string;
    created_at?: string;
}

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

interface AdminUserDetailProps {
    user: UserData;
    onClose: () => void;
    papers?: Paper[];
    annotations?: Annotation[];
    tags?: Record<string, Tag>;
}

export function AdminUserDetail({ user, onClose, papers = [], annotations = [], tags = {} }: AdminUserDetailProps) {
    const [userPapers, setUserPapers] = useState<Paper[]>([]);
    const [userAnnotations, setUserAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState(user.admin_notes || "");
    const [saving, setSaving] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [viewingPaperId, setViewingPaperId] = useState<string | null>(null);

    useEffect(() => {
        // Filter data for this user if passed from parent, otherwise fetch
        if (papers.length > 0) {
            setUserPapers(papers.filter(p => p.user_id === user.id));
            setUserAnnotations(annotations.filter(a => a.user_id === user.id));
            setLoading(false);
        } else {
            const fetchPapers = async () => {
                try {
                    const q = query(collection(db, "papers"), where("user_id", "==", user.id));
                    const snapshot = await getDocs(q);
                    const papersData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Paper[];
                    setUserPapers(papersData);
                } catch (error) {
                    console.error("Error fetching papers:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPapers();
        }
    }, [user.id, papers, annotations]);

    const handleSaveNote = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", user.id), {
                admin_notes: note
            });
            alert("Note saved!");
            setIsNoteOpen(false);
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto relative flex flex-col">
                <div className="absolute right-4 top-4 flex gap-2 z-10">
                    <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <MessageSquare size={16} /> Leave Notes
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Admin Notes for {user.email}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <Textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Enter notes about this user..."
                                    className="min-h-[150px]"
                                />
                                <Button onClick={handleSaveNote} disabled={saving} className="w-full">
                                    {saving ? "Saving..." : "Save Note"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <CardContent className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-[400px]">Loading user data...</div>
                    ) : (
                        <UserDashboard
                            userEmail={user.email}
                            papers={userPapers}
                            annotations={userAnnotations}
                            tags={tags}
                            readOnly={true}
                            onPaperClick={(paperId) => setViewingPaperId(paperId)}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Paper View Modal */}
            <Dialog open={!!viewingPaperId} onOpenChange={(open) => !open && setViewingPaperId(null)}>
                <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {userPapers.find(p => p.id === viewingPaperId)?.title || "Paper View"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-4">
                        {/* Main Content: Paper Text */}
                        <div className="lg:col-span-3">
                            {viewingPaperId && (
                                <Highlighter
                                    paperId={viewingPaperId}
                                    text={userPapers.find(p => p.id === viewingPaperId)?.abstract_text || ""}
                                    targetUserId={user.id}
                                    readOnly={true}
                                />
                            )}
                        </div>

                        {/* Sidebar: Tag Summary */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium">Tag Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-3">
                                    {viewingPaperId && (() => {
                                        const currentAnns = userAnnotations.filter(a => a.paper_id === viewingPaperId);
                                        const tagCounts: Record<string, number> = {};
                                        currentAnns.forEach(ann => {
                                            const tagId = ann.tag_id;
                                            tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
                                        });

                                        if (currentAnns.length === 0) {
                                            return <p className="text-sm text-gray-500 italic">No highlights yet.</p>;
                                        }

                                        return Object.entries(tagCounts)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([tagId, count]) => {
                                                const tag = tags[tagId];
                                                if (!tag) return null;
                                                return (
                                                    <div key={tagId} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: tag.color }}
                                                            />
                                                            <span className="text-sm font-medium text-gray-700">{tag.label}</span>
                                                        </div>
                                                        <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                            {count}
                                                        </span>
                                                    </div>
                                                );
                                            });
                                    })()}
                                </CardContent>
                            </Card>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h4 className="text-sm font-semibold text-blue-900 mb-2">About this Paper</h4>
                                <p className="text-xs text-blue-800">
                                    Total Highlights: {userAnnotations.filter(a => a.paper_id === viewingPaperId).length}
                                </p>
                                <p className="text-xs text-blue-800 mt-1">
                                    Last Activity: {(() => {
                                        const currentAnns = userAnnotations.filter(a => a.paper_id === viewingPaperId);
                                        if (currentAnns.length === 0) return "N/A";
                                        const dates = currentAnns.map(a => a.created_at ? new Date(a.created_at).getTime() : 0);
                                        const maxDate = Math.max(...dates);
                                        return maxDate > 0 ? new Date(maxDate).toLocaleDateString() : "N/A";
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
