"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { Plus } from "lucide-react";

export function AddPaperModal() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [abstract, setAbstract] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!auth.currentUser) {
                console.error("User not authenticated.");
                setLoading(false);
                return;
            }
            const userId = auth.currentUser.uid;

            // Get current max order for this user
            // Note: This query might require an index. If it fails, we can handle it.
            // For MVP without index creation flow, we might need to fetch all and sort in JS,
            // but let's try the proper query first. If it fails, the user will see an error in console.
            // Actually, for safety/speed in this context without console access, let's just fetch all for user and find max.
            // It's safer than blocking on index creation.

            const allUserPapersQ = query(collection(db, "papers"), where("user_id", "==", userId));
            const querySnapshot = await getDocs(allUserPapersQ);

            let newOrder = 0;
            if (!querySnapshot.empty) {
                const maxOrder = Math.max(...querySnapshot.docs.map(d => d.data().order || 0));
                newOrder = maxOrder + 1;
            }

            await addDoc(collection(db, "papers"), {
                title,
                abstract_text: abstract,
                created_at: serverTimestamp(),
                order: newOrder,
                user_id: userId, // Added user_id
            });
            setOpen(false);
            setTitle("");
            setAbstract("");
        } catch (error) {
            console.error("Error adding paper: ", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={16} /> Add Paper
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Paper</DialogTitle>
                        <DialogDescription>
                            Enter the details of the research paper you want to analyze.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="file" className="text-right">
                                Upload PDF
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="file"
                                    type="file"
                                    accept=".pdf"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setLoading(true);
                                            try {
                                                const { extractTextFromPdf } = await import("@/utils/pdf-extraction");
                                                const { title, abstract } = await extractTextFromPdf(file);
                                                setTitle(title.replace(/\n/g, " "));
                                                setAbstract(abstract.replace(/\n/g, " "));
                                            } catch (error) {
                                                console.error("Failed to extract PDF", error);
                                                // Ideally show a toast or error message here
                                            } finally {
                                                setLoading(false);
                                            }
                                        }
                                    }}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Upload a PDF to automatically extract Title and Abstract.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="abstract" className="text-right">
                                Abstract
                            </Label>
                            <Textarea
                                id="abstract"
                                value={abstract}
                                onChange={(e) => setAbstract(e.target.value.replace(/\n/g, " "))}
                                className="col-span-3 h-32"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Paper"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
