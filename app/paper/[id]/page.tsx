"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Highlighter } from "@/components/Highlighter";
import { TagManager } from "@/components/TagManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Paper {
    id: string;
    title: string;
    abstract_text: string;
}

export default function PaperPage() {
    const { id } = useParams();
    const router = useRouter();
    const [paper, setPaper] = useState<Paper | null>(null);
    const [allPapers, setAllPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);

    // Session tracking
    const sessionIdRef = useRef<string | null>(null);
    const sessionStartRef = useRef<number>(0);
    const isVisibleRef = useRef<boolean>(true);
    const pausedTimeRef = useRef<number>(0);

    // Create or find session on mount
    useEffect(() => {
        const initSession = async () => {
            if (!id || !auth.currentUser) return;

            try {
                // Find existing session for this user-paper pair
                const sessionsQuery = query(
                    collection(db, "paper_sessions"),
                    where("user_id", "==", auth.currentUser.uid),
                    where("paper_id", "==", id as string)
                );
                const existingSessions = await getDocs(sessionsQuery);

                if (existingSessions.empty) {
                    // Create new session document
                    const sessionRef = await addDoc(collection(db, "paper_sessions"), {
                        user_id: auth.currentUser.uid,
                        paper_id: id as string,
                        start_time: serverTimestamp(),
                        last_updated: serverTimestamp(),
                        duration_seconds: 0
                    });
                    sessionIdRef.current = sessionRef.id;
                } else {
                    // Use existing session
                    sessionIdRef.current = existingSessions.docs[0].id;
                }

                sessionStartRef.current = Date.now();
                console.log("[Session] Initialized:", sessionIdRef.current);
            } catch (error) {
                console.error("[Session] Error initializing:", error);
            }
        };

        initSession();

        // Save session on unmount
        return () => {
            if (sessionIdRef.current) {
                saveSession();
            }
        };
    }, [id]);

    // Handle visibility changes (pause when tab hidden)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                isVisibleRef.current = false;
                pausedTimeRef.current = Date.now();
                console.log("[Session] Paused");
            } else {
                if (!isVisibleRef.current && pausedTimeRef.current > 0) {
                    // Subtract paused time from start
                    const pausedDuration = Date.now() - pausedTimeRef.current;
                    sessionStartRef.current += pausedDuration;
                    console.log("[Session] Resumed, paused for:", pausedDuration / 1000, "s");
                }
                isVisibleRef.current = true;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    // Heartbeat to update session every 1 second
    useEffect(() => {
        const interval = setInterval(() => {
            if (sessionIdRef.current && isVisibleRef.current) {
                updateSessionDuration();
            }
        }, 1000); // 1 second

        return () => clearInterval(interval);
    }, []);

    const updateSessionDuration = async () => {
        if (!sessionIdRef.current || sessionStartRef.current === 0) return;

        const currentDuration = Math.floor((Date.now() - sessionStartRef.current) / 1000);

        try {
            const sessionDoc = await getDoc(doc(db, "paper_sessions", sessionIdRef.current));
            if (sessionDoc.exists()) {
                const existingDuration = sessionDoc.data().duration_seconds || 0;
                const newTotalDuration = existingDuration + currentDuration;

                await updateDoc(doc(db, "paper_sessions", sessionIdRef.current), {
                    duration_seconds: newTotalDuration,
                    last_updated: serverTimestamp()
                });

                // Reset start time for next interval
                sessionStartRef.current = Date.now();

                console.log("[Session] Updated total duration:", newTotalDuration, "s");
            }
        } catch (error) {
            console.error("[Session] Error updating:", error);
        }
    };

    const saveSession = async () => {
        if (!sessionIdRef.current || sessionStartRef.current === 0) return;

        const currentDuration = Math.floor((Date.now() - sessionStartRef.current) / 1000);

        try {
            const sessionDoc = await getDoc(doc(db, "paper_sessions", sessionIdRef.current));
            if (sessionDoc.exists()) {
                const existingDuration = sessionDoc.data().duration_seconds || 0;
                const newTotalDuration = existingDuration + currentDuration;

                await updateDoc(doc(db, "paper_sessions", sessionIdRef.current), {
                    duration_seconds: newTotalDuration,
                    last_updated: serverTimestamp()
                });

                console.log("[Session] Saved, total duration:", newTotalDuration, "s");
            }
        } catch (error) {
            console.error("[Session] Error saving:", error);
        }
    };

    useEffect(() => {
        const fetchPaperAndAll = async () => {
            if (!id) return;

            try {
                // 1. Fetch current paper
                const docRef = doc(db, "papers", id as string);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const currentPaperData = { id: docSnap.id, ...docSnap.data() } as Paper;
                    setPaper(currentPaperData);

                    // 2. Fetch all papers for this user to determine order
                    // We use the user_id from the current paper to ensure consistency
                    // or auth.currentUser if available. Ideally they match.
                    const userId = (currentPaperData as any).user_id || auth.currentUser?.uid;

                    if (userId) {
                        const q = query(collection(db, "papers"), where("user_id", "==", userId));
                        const querySnapshot = await getDocs(q);
                        const papersData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Paper));

                        // Client-side sort by order
                        papersData.sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0));
                        setAllPapers(papersData);
                    }
                } else {
                    console.log("No such document!");
                }
            } catch (error) {
                console.error("Error fetching paper:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPaperAndAll();
    }, [id]);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    if (!paper) return <div className="flex items-center justify-center min-h-screen">Paper not found</div>;

    const currentIndex = allPapers.findIndex(p => p.id === paper.id);
    const position = currentIndex + 1;
    const total = allPapers.length;
    const prevPaper = currentIndex > 0 ? allPapers[currentIndex - 1] : null;
    const nextPaper = currentIndex < total - 1 ? allPapers[currentIndex + 1] : null;

    const getOrdinalSuffix = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{paper.title}</h1>
                        <p className="text-sm text-gray-500">
                            {total > 0 ? `${getOrdinalSuffix(position)} out of ${total}` : `Paper ID: ${paper.id}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={!prevPaper}
                        onClick={() => prevPaper && router.push(`/paper/${prevPaper.id}`)}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!nextPaper}
                        onClick={() => nextPaper && router.push(`/paper/${nextPaper.id}`)}
                    >
                        Next
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Text Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl mx-auto">
                        <Highlighter
                            paperId={paper.id}
                            text={paper.abstract_text}
                            onUpdate={(newText) => setPaper({ ...paper, abstract_text: newText })}
                        />
                    </div>
                </div>

                {/* Right: Tag Manager */}
                <div className="w-80 border-l bg-white shadow-lg z-20">
                    <TagManager />
                </div>
            </div>
        </div>
    );
}
