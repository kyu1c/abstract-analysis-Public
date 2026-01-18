import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { deleteDoc, doc, writeBatch, collection, getDocs } from "firebase/firestore";

interface Paper {
    id: string;
    title: string;
    user_id: string;
    created_at?: string;
}

interface DatabaseManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    papers: Paper[];
    onRefresh: () => void;
}

export function DatabaseManagementModal({ isOpen, onClose, papers, onRefresh }: DatabaseManagementModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeletePaper = async (paperId: string) => {
        if (!confirm("Are you sure you want to delete this paper? This action cannot be undone.")) return;

        setIsDeleting(true);
        try {
            // 1. Delete the paper document
            await deleteDoc(doc(db, "papers", paperId));

            // 2. We should also delete associated annotations, but for now let's just delete the paper
            // Ideally we'd query for annotations with this paper_id and delete them too.
            // Let's do a quick cleanup of annotations for this paper
            const annsRef = collection(db, "annotations");
            const annsSnap = await getDocs(annsRef); // This is expensive if many annotations, but okay for admin tool
            const batch = writeBatch(db);

            let deleteCount = 0;
            annsSnap.docs.forEach(doc => {
                if (doc.data().paper_id === paperId) {
                    batch.delete(doc.ref);
                    deleteCount++;
                }
            });

            if (deleteCount > 0) await batch.commit();

            alert("Paper deleted successfully.");
            onRefresh();
        } catch (error: any) {
            console.error("Error deleting paper:", error);
            alert("Failed to delete paper: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleNukeDatabase = async () => {
        const confirmText = "DELETE ALL DATA";
        const input = prompt(`WARNING: This will delete ALL papers and annotations in the database.\n\nType "${confirmText}" to confirm.`);

        if (input !== confirmText) return;

        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            let opCount = 0;

            // Delete all papers
            papers.forEach(p => {
                batch.delete(doc(db, "papers", p.id));
                opCount++;
            });

            // Delete all annotations (fetching all first)
            const annsSnap = await getDocs(collection(db, "annotations"));
            annsSnap.docs.forEach(d => {
                batch.delete(d.ref);
                opCount++;
            });

            // Firestore batch limit is 500. If we have more, we need to chunk.
            // For now assuming < 500 ops for this simple tool. 
            // If > 500, commit and start new batch.
            if (opCount > 500) {
                alert("Too many items to delete in one go. Please delete manually or implement chunking.");
                // Fallback: just try to commit what we have, might fail
            }

            await batch.commit();
            alert("Database cleared successfully.");
            onRefresh();
            onClose();
        } catch (error: any) {
            console.error("Error clearing database:", error);
            alert("Failed to clear database: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Database Management</DialogTitle>
                    <DialogDescription>
                        Inspect and manage database records directly.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-red-50 p-4 rounded-md border border-red-200">
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertTriangle size={20} />
                            <span className="font-bold">Danger Zone</span>
                        </div>
                        <Button variant="destructive" size="sm" onClick={handleNukeDatabase} disabled={isDeleting}>
                            <Trash2 size={16} className="mr-2" /> Delete All Papers & Annotations
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {papers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                            No papers found in database.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    papers.map((paper) => (
                                        <TableRow key={paper.id}>
                                            <TableCell className="font-mono text-xs text-gray-500">
                                                {paper.id.substring(0, 8)}...
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {paper.title}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {paper.user_id}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {paper.created_at ? new Date(paper.created_at).toLocaleDateString() : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeletePaper(paper.id)}
                                                    disabled={isDeleting}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
