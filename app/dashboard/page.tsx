"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { UserDashboard } from "@/components/UserDashboard";

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

export default function DashboardPage() {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [tags, setTags] = useState<Record<string, TagData>>({});
    const [loading, setLoading] = useState(true);

    const router = useRouter();
    const user = auth.currentUser;

    useEffect(() => {
        if (!auth.currentUser) {
            const timer = setTimeout(() => {
                if (!auth.currentUser) router.push("/login");
            }, 1000);
            return () => clearTimeout(timer);
        }

        const fetchData = async () => {
            if (!user) return;

            try {
                // Fetch User's Papers
                const papersQ = query(collection(db, "papers"), where("user_id", "==", user.uid));
                const papersSnap = await getDocs(papersQ);
                const papersData = papersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Paper[];

                // Fetch User's Annotations
                const annsQ = query(collection(db, "annotations"), where("user_id", "==", user.uid));
                const annsSnap = await getDocs(annsQ);
                const annsData = annsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Annotation[];

                // Fetch Tags
                const tagsQ = query(collection(db, "tags"), where("user_id", "==", user.uid));
                const tagsSnap = await getDocs(tagsQ);
                const tagsMap: Record<string, TagData> = {};
                tagsSnap.docs.forEach(doc => {
                    tagsMap[doc.id] = { id: doc.id, ...doc.data() } as TagData;
                });

                setPapers(papersData);
                setAnnotations(annsData);
                setTags(tagsMap);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, router]);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <UserDashboard
                    userEmail={user?.email || ""}
                    papers={papers}
                    annotations={annotations}
                    tags={tags}
                />
            </div>
        </div>
    );
}
