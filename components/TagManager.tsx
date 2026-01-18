"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { useStore } from "@/lib/store";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Tag {
    id: string;
    label: string;
    color: string;
    user_id: string;
    order?: number;
}

const PRESET_COLORS = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEEAD", // Yellow
    "#D4A5A5", // Pink
    "#9B59B6", // Purple
    "#3498DB", // Dark Blue
];

function SortableTagItem({ tag, activeTagId, setActiveTagId, handleDeleteTag }: { tag: Tag, activeTagId: string | null, setActiveTagId: (id: string | null) => void, handleDeleteTag: (id: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: tag.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-2 rounded-md transition-colors group ${activeTagId === tag.id ? "bg-gray-100 ring-1 ring-gray-300" : "hover:bg-gray-50"
                }`}
            onClick={() => setActiveTagId(tag.id)}
        >
            <div className="flex items-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical size={14} />
                </div>
                <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm font-medium">{tag.label}</span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag.id);
                }}
            >
                <Trash2 size={14} />
            </Button>
        </div>
    );
}

export function TagManager() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [newTagLabel, setNewTagLabel] = useState("");
    const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
    const { activeTagId, setActiveTagId } = useStore();
    const user = auth.currentUser;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "tags"), where("user_id", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Tag[];

            // Sort by order
            tagsData.sort((a, b) => (a.order || 0) - (b.order || 0));

            setTags(tagsData);
        });

        return () => unsubscribe();
    }, [user]);

    const handleAddTag = async () => {
        if (!newTagLabel.trim() || !user) return;

        const newOrder = tags.length > 0 ? (tags[tags.length - 1].order || 0) + 1 : 0;

        await addDoc(collection(db, "tags"), {
            label: newTagLabel,
            color: selectedColor,
            user_id: user.uid,
            order: newOrder,
        });
        setNewTagLabel("");
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm("Are you sure you want to delete this tag?")) return;
        await deleteDoc(doc(db, "tags", id));
        if (activeTagId === id) setActiveTagId(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setTags((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update Firestore
                updateOrderInFirestore(newItems);

                return newItems;
            });
        }
    };

    const updateOrderInFirestore = async (items: Tag[]) => {
        const batch = writeBatch(db);
        items.forEach((item, index) => {
            const docRef = doc(db, "tags", item.id);
            batch.update(docRef, { order: index });
        });
        await batch.commit();
    };

    return (
        <div className="h-full flex flex-col border-l bg-white">
            <div className="p-4 border-b">
                <h3 className="font-semibold mb-4">Tags</h3>
                <div className="space-y-3">
                    <Input
                        placeholder="New tag name..."
                        value={newTagLabel}
                        onChange={(e) => setNewTagLabel(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                className={`w-6 h-6 rounded-full border-2 ${selectedColor === color ? "border-black" : "border-transparent"
                                    }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setSelectedColor(color)}
                            />
                        ))}
                    </div>
                    <Button onClick={handleAddTag} className="w-full" size="sm">
                        <Plus size={16} className="mr-2" /> Create Tag
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={tags.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {tags.map((tag) => (
                                <SortableTagItem
                                    key={tag.id}
                                    tag={tag}
                                    activeTagId={activeTagId}
                                    setActiveTagId={setActiveTagId}
                                    handleDeleteTag={handleDeleteTag}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </ScrollArea>
        </div>
    );
}
