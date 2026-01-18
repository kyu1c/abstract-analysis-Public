"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, writeBatch, doc, deleteDoc, where, getDoc, setDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddPaperModal } from "@/components/AddPaperModal";
import { SortablePaperCard } from "@/components/SortablePaperCard";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { Pencil, Check } from "lucide-react";

interface Paper {
  id: string;
  title: string;
  abstract_text: string;
  order?: number;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        // Sync user to Firestore if missing (e.g. created before we added sync logic)
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              role: "user",
              created_at: new Date().toISOString(),
            });
            console.log("User profile created for:", currentUser.email);
          }
        } catch (error: any) {
          console.error("Error syncing user:", error);
          alert("Failed to sync user profile: " + error.message);
        }
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    // Filter by user_id. Sorting by 'order' might require an index with 'where'.
    // To avoid index issues, we fetch by user_id and sort client-side.
    const q = query(collection(db, "papers"), where("user_id", "==", user.uid));

    const unsubscribePapers = onSnapshot(q, (snapshot) => {
      const papersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Paper[];

      // Client-side sort
      papersData.sort((a, b) => (a.order || 0) - (b.order || 0));

      setPapers(papersData);
    });

    return () => unsubscribePapers();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setPapers((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update Firestore order
        // We need to update the 'order' field for all affected items
        // Ideally, we should do this in a batch
        updateOrderInFirestore(newItems);

        return newItems;
      });
    }
  };

  const updateOrderInFirestore = async (items: Paper[]) => {
    const batch = writeBatch(db);
    items.forEach((item, index) => {
      const docRef = doc(db, "papers", item.id);
      batch.update(docRef, { order: index + 1 });
    });
    await batch.commit();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this paper?")) {
      try {
        // 1. Delete all annotations associated with this paper
        const annotationsQ = query(collection(db, "annotations"), where("paper_id", "==", id));
        const annotationsSnap = await getDocs(annotationsQ);

        const batch = writeBatch(db);
        annotationsSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // 2. Delete the paper itself
        const paperRef = doc(db, "papers", id);
        batch.delete(paperRef);

        await batch.commit();
        console.log("Paper and associated annotations deleted successfully");
      } catch (error) {
        console.error("Error deleting paper:", error);
        alert("Failed to delete paper");
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Abstract Analysis Tool</h1>
          <p className="text-gray-600">Welcome, {user.email}</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            My Dashboard
          </Button>
          {user.email === "unikyu20@unist.ac.kr" && (
            <Button variant="secondary" onClick={() => router.push("/admin")}>
              Admin Dashboard
            </Button>
          )}
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Available Papers</h2>
          <div className="flex gap-2">
            <Button
              variant={isDeleteMode ? "default" : "outline"}
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              className="gap-2"
            >
              {isDeleteMode ? <Check size={16} /> : <Pencil size={16} />}
              {isDeleteMode ? "Done" : "Edit List"}
            </Button>
            <AddPaperModal />
          </div>
        </div>

        {papers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No papers found. Add one to get started!</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={papers.map(p => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {papers.map((paper, index) => (
                  <SortablePaperCard
                    key={paper.id}
                    paper={paper}
                    index={index + 1}
                    isDeleteMode={isDeleteMode}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}
