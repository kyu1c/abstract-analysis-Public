"use client";

import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminUserDetail } from "@/components/AdminUserDetail";
import { AdminStatsCards } from "@/components/AdminStatsCards";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { AdminPaperAnalysis } from "@/components/AdminPaperAnalysis";
import { Download, Database, Users, MessageSquare } from "lucide-react";
import { seedTestDatabase, createDummyUser } from "@/utils/seed-data";
import { SeedDataModal } from "@/components/SeedDataModal";
import { UserManagementModal } from "@/components/UserManagementModal";
import { DatabaseManagementModal } from "@/components/DatabaseManagementModal";

interface UserData {
    id: string;
    email: string;
    role: string;
    admin_notes?: string;
    created_at?: string;
    paperCount?: number;
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
    start_index: number;
    end_index: number;
    deleted_at?: string;
}

interface Tag {
    id: string;
    label: string;
    color: string;
}

const ADMIN_EMAIL = "unikyu20@unist.ac.kr";

export default function AdminPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [papers, setPapers] = useState<Paper[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [tags, setTags] = useState<Record<string, Tag>>({});

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [editingNoteUser, setEditingNoteUser] = useState<UserData | null>(null);
    const [noteText, setNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    const router = useRouter();
    const currentUser = auth.currentUser;

    const fetchData = async () => {
        setLoading(true);
        try {
            // Ensure Admin User Exists
            if (auth.currentUser) {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    role: "admin",
                }, { merge: true });
            }

            // Parallel Fetching
            const [usersSnap, papersSnap, annsSnap, tagsSnap] = await Promise.all([
                getDocs(collection(db, "users")),
                getDocs(collection(db, "papers")),
                getDocs(collection(db, "annotations")),
                getDocs(collection(db, "tags"))
            ]);

            // Process Users
            const usersData = usersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserData[];

            // Process Papers
            const papersData = papersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Paper[];

            // Process Annotations
            const annsData = annsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Annotation[];

            // Process Tags
            const tagsMap: Record<string, Tag> = {};
            tagsSnap.docs.forEach(doc => {
                tagsMap[doc.id] = { id: doc.id, ...doc.data() } as Tag;
            });

            // Calculate paper counts per user
            const usersWithCounts = usersData.map(user => {
                const count = papersData.filter(p => p.user_id === user.id).length;
                return { ...user, paperCount: count };
            });

            setUsers(usersWithCounts);
            setPapers(papersData);
            setAnnotations(annsData);
            setTags(tagsMap);

        } catch (error: any) {
            console.error("Error fetching admin data:", error);
            setError("Failed to load data. Check Firestore Rules. Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!auth.currentUser) {
            const timer = setTimeout(() => {
                if (!auth.currentUser) router.push("/login");
            }, 1000);
            return () => clearTimeout(timer);
        }

        if (auth.currentUser.email !== ADMIN_EMAIL) {
            router.push("/");
            return;
        }

        fetchData();
    }, [router, currentUser]);

    // Calculate Global Stats
    const stats = useMemo(() => {
        const totalParticipants = users.length;

        // Filter out orphaned annotations (paper doesn't exist) and soft-deleted ones
        const validAnnotations = annotations.filter(ann => {
            const paperExists = papers.some(p => p.id === ann.paper_id);
            const isNotDeleted = !ann.deleted_at;
            return paperExists && isNotDeleted;
        });

        const totalAnnotations = validAnnotations.length;
        // Avg Tags per Paper = Total Annotations / Total Papers (that have annotations?)
        // Or just Total Annotations / Total Papers in system?
        // Let's do Total Annotations / Total Papers (uploaded)
        const avgTagsPerPaper = papers.length > 0 ? totalAnnotations / papers.length : 0;

        // Most Used Tag
        const tagCounts: Record<string, number> = {};
        validAnnotations.forEach(ann => {
            const label = tags[ann.tag_id]?.label;
            if (label) {
                tagCounts[label] = (tagCounts[label] || 0) + 1;
            }
        });

        let mostUsedTag = "-";
        let maxCount = 0;
        Object.entries(tagCounts).forEach(([label, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostUsedTag = label;
            }
        });

        return {
            totalParticipants,
            totalAnnotations,
            totalPapers: papers.length,
            avgTagsPerPaper,
            mostUsedTag
        };
    }, [users, papers, annotations, tags]);

    const handleExportUserCSV = (user: UserData) => {
        const userAnns = annotations.filter(a => a.user_id === user.id);

        // CSV Header
        const headers = ["Paper ID", "Paper Title", "Tag Label", "Highlighted Text", "Start Index", "End Index"];

        // CSV Rows
        const rows = userAnns.map(ann => {
            const paper = papers.find(p => p.id === ann.paper_id);
            const tag = tags[ann.tag_id];
            return [
                ann.paper_id,
                paper ? `"${paper.title.replace(/"/g, '""')}"` : "Unknown Paper",
                tag ? tag.label : "Unknown Tag",
                `"${ann.text_content.replace(/"/g, '""')}"`,
                ann.start_index,
                ann.end_index
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `user_data_${user.email}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
    const [isDbModalOpen, setIsDbModalOpen] = useState(false);
    const [isUserManageModalOpen, setIsUserManageModalOpen] = useState(false);

    const handleResetUserData = async (userId: string) => {
        try {
            const batch = writeBatch(db);

            // 1. Delete Papers
            const papersToDelete = papers.filter(p => p.user_id === userId);
            papersToDelete.forEach(p => batch.delete(doc(db, "papers", p.id)));

            // 2. Delete Annotations
            const annsToDelete = annotations.filter(a => a.user_id === userId);
            annsToDelete.forEach(a => batch.delete(doc(db, "annotations", a.id)));

            // 3. Delete Tags
            const tagsToDelete = Object.values(tags).filter((t: any) => t.user_id === userId);
            tagsToDelete.forEach((t: any) => batch.delete(doc(db, "tags", t.id)));

            await batch.commit();
            alert("User data reset successfully.");
            fetchData();
        } catch (error: any) {
            console.error("Reset error:", error);
            alert("Failed to reset data: " + error.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            // First reset data
            await handleResetUserData(userId);

            // Then delete user document
            await deleteDoc(doc(db, "users", userId));

            alert("User deleted successfully.");
            fetchData();
        } catch (error: any) {
            console.error("Delete user error:", error);
            alert("Failed to delete user: " + error.message);
        }
    };

    const handleOpenNoteModal = (user: UserData) => {
        setEditingNoteUser(user);
        setNoteText(user.admin_notes || "");
    };

    const handleSaveNote = async () => {
        if (!editingNoteUser) return;
        setSavingNote(true);
        try {
            await setDoc(doc(db, "users", editingNoteUser.id), {
                admin_notes: noteText
            }, { merge: true });

            // Update local state
            setUsers(users.map(u => u.id === editingNoteUser.id ? { ...u, admin_notes: noteText } : u));
            setEditingNoteUser(null);
            alert("Note saved successfully");
        } catch (error: any) {
            console.error("Error saving note:", error);
            alert("Failed to save note: " + error.message);
        } finally {
            setSavingNote(false);
        }
    };

    const handleSeedData = async (options: any) => {
        try {
            const result = await seedTestDatabase(options);
            if (result.success) {
                alert("Success: " + result.message);
                setIsSeedModalOpen(false);
                // Trigger data refresh
                fetchData();
            } else {
                alert("Error: " + result.message);
            }
        } catch (e: any) {
            alert("Unexpected error: " + e.message);
        }
    };

    const handleCreateDummyUser = async () => {
        const confirmCreate = confirm("Create a new dummy user (testN@test.com) with randomized data?");
        if (!confirmCreate) return;

        setLoading(true);
        try {
            const result = await createDummyUser();
            if (result.success) {
                alert(result.message);
                fetchData();
            } else {
                alert("Error: " + result.message);
            }
        } catch (error: any) {
            console.error("Error creating dummy user:", error);
            alert("Failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Cognitive Research Dashboard</h1>
                        <p className="text-gray-500">Overview of participant analysis and abstract data</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsSeedModalOpen(true)} className="gap-2">
                            <Database size={16} /> Seed Test Data
                        </Button>
                        <Button variant="outline" onClick={handleCreateDummyUser} className="gap-2">
                            <Users size={16} /> Create Dummy User
                        </Button>

                        <Button variant="outline" onClick={() => setIsDbModalOpen(true)} className="gap-2">
                            <Database size={16} /> Manage DB
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/")}>Back to Home</Button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Section A: Stats Cards */}
                <AdminStatsCards stats={stats} onManageUsers={() => setIsUserManageModalOpen(true)} />

                {/* Main Content Tabs */}
                <Tabs defaultValue="analytics" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="paper-view">Paper View</TabsTrigger>
                        <TabsTrigger value="user-view">User View</TabsTrigger>
                    </TabsList>

                    {/* Section A: Analytics (New) */}
                    <TabsContent value="analytics" className="mt-6">
                        <AdminAnalytics
                            users={users}
                            papers={papers}
                            annotations={annotations}
                            tags={tags}
                        />
                    </TabsContent>

                    {/* Section B: Paper-Centric Analysis */}
                    <TabsContent value="paper-view" className="mt-6">
                        <AdminPaperAnalysis
                            papers={papers}
                            annotations={annotations}
                            tags={tags}
                            users={users}
                        />
                    </TabsContent>

                    {/* Section C: Participant Management */}
                    {/* Section C: Participant Management */}
                    <TabsContent value="user-view" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Participant Management</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead>Papers Assigned</TableHead>
                                            <TableHead>View</TableHead>
                                            <TableHead className="text-right">Download Data</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.email}</TableCell>
                                                <TableCell>{user.role}</TableCell>
                                                <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</TableCell>
                                                <TableCell>{user.paperCount || 0}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                                                        View Dashboard
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleOpenNoteModal(user)}>
                                                        <MessageSquare size={14} className="mr-1" /> View Notes
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="secondary" onClick={() => handleExportUserCSV(user)}>
                                                        <Download size={14} className="mr-1" /> CSV
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {selectedUser && (
                <AdminUserDetail
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    papers={papers}
                    annotations={annotations}
                    tags={tags}
                />
            )}

            <SeedDataModal
                isOpen={isSeedModalOpen}
                onClose={() => setIsSeedModalOpen(false)}
                users={users}
                onSeed={handleSeedData}
            />

            <UserManagementModal
                isOpen={isUserManageModalOpen}
                onClose={() => setIsUserManageModalOpen(false)}
                users={users}
                onResetData={handleResetUserData}
                onDeleteUser={handleDeleteUser}
            />

            <DatabaseManagementModal
                isOpen={isDbModalOpen}
                onClose={() => setIsDbModalOpen(false)}
                papers={papers}
                onRefresh={fetchData}
            />

            <Dialog open={!!editingNoteUser} onOpenChange={(open) => !open && setEditingNoteUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Admin Notes for {editingNoteUser?.email}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Enter notes about this user..."
                            className="min-h-[150px]"
                        />
                        <Button onClick={handleSaveNote} disabled={savingNote} className="w-full">
                            {savingNote ? "Saving..." : "Save Note"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
