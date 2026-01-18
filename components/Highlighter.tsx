"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Pencil, Save, X } from "lucide-react";

interface Annotation {
    id: string;
    start_index: number;
    end_index: number;
    tag_id: string;
    text_content: string;
    tag_color?: string; // Populated after fetching
    tag_label?: string; // Populated after fetching
}

interface Tag {
    id: string;
    label: string;
    color: string;
}

interface HighlighterProps {
    paperId: string;
    text: string;
    onUpdate?: (newText: string) => void;
    targetUserId?: string;
    readOnly?: boolean;
}

export function Highlighter({ paperId, text, onUpdate, targetUserId, readOnly }: HighlighterProps) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [tags, setTags] = useState<Record<string, Tag>>({});
    const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

    // Edit Menu State (for existing highlights)
    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const [editMenuPosition, setEditMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(text);
    const [saving, setSaving] = useState(false);

    const textRef = useRef<HTMLDivElement>(null);
    const currentUser = auth.currentUser;
    const effectiveUserId = targetUserId || currentUser?.uid;

    // Sync editText when prop text changes (if not editing)
    useEffect(() => {
        if (!isEditing) {
            setEditText(text);
        }
    }, [text, isEditing]);

    // Fetch Tags to map colors
    useEffect(() => {
        if (!effectiveUserId) return;
        const q = query(collection(db, "tags"), where("user_id", "==", effectiveUserId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsMap: Record<string, Tag> = {};
            snapshot.docs.forEach((doc) => {
                tagsMap[doc.id] = { id: doc.id, ...doc.data() } as Tag;
            });
            setTags(tagsMap);
        });
        return () => unsubscribe();
    }, [effectiveUserId]);

    // Fetch Annotations
    useEffect(() => {
        if (!effectiveUserId) return;
        // Filter out soft-deleted annotations
        const q = query(
            collection(db, "annotations"),
            where("paper_id", "==", paperId),
            where("user_id", "==", effectiveUserId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const anns = snapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                // Client-side filter for deleted_at because Firestore query with multiple inequalities/where clauses can be tricky with indexes
                // or we can add where("deleted_at", "==", null) if we index it. 
                // For now, client-side filtering is safer and easier for small datasets.
                .filter((ann: any) => !ann.deleted_at) as Annotation[];

            setAnnotations(anns);
        });
        return () => unsubscribe();
    }, [effectiveUserId, paperId]);

    const handleMouseUp = () => {
        if (isEditing || readOnly) return; // Disable highlighting in edit mode or readOnly

        const selectionObj = window.getSelection();
        if (!selectionObj || selectionObj.rangeCount === 0 || selectionObj.isCollapsed) {
            setPopoverOpen(false);
            return;
        }

        const range = selectionObj.getRangeAt(0);
        const container = textRef.current;

        // Ensure selection is within our text container
        if (!container || !container.contains(range.commonAncestorContainer)) return;

        // Calculate absolute start/end indices relative to the text content
        // This is tricky because the DOM contains spans for existing highlights.
        // We need to map the DOM selection to the raw text indices.
        // For MVP simplicity: We assume the text is rendered as a sequence of spans and text nodes.
        // A robust solution requires traversing the DOM to count characters.

        const start = getAbsoluteOffset(container, range.startContainer, range.startOffset);
        const end = getAbsoluteOffset(container, range.endContainer, range.endOffset);
        const selectedText = selectionObj.toString();

        if (start !== -1 && end !== -1 && start < end) {
            setSelection({ start, end, text: selectedText });

            const rect = range.getBoundingClientRect();
            setPopoverPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10, // slightly above
            });
            setPopoverOpen(true);
        }
    };

    const getAbsoluteOffset = (root: Node, node: Node, offset: number): number => {
        let currentOffset = 0;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {
            const currentNode = walker.currentNode;
            if (currentNode === node) {
                return currentOffset + offset;
            }
            currentOffset += currentNode.textContent?.length || 0;
        }
        return -1;
    };

    const handleAddAnnotation = async (tagId: string) => {
        if (!selection || !effectiveUserId || readOnly) return;

        await addDoc(collection(db, "annotations"), {
            paper_id: paperId,
            user_id: effectiveUserId,
            tag_id: tagId,
            text_content: selection.text,
            start_index: selection.start,
            end_index: selection.end,
            created_at: new Date().toISOString(), // Added for analytics
            updated_at: new Date().toISOString()  // Added for analytics
        });

        setPopoverOpen(false);
        setSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleDeleteAnnotation = async (id: string) => {
        if (isEditing || readOnly) return;
        // Soft delete: update deleted_at timestamp
        await updateDoc(doc(db, "annotations", id), {
            deleted_at: new Date().toISOString()
        });
        setEditMenuOpen(false);
        setSelectedAnnotation(null);
    };

    const handleChangeTag = async (annotationId: string, newTagId: string) => {
        if (isEditing || readOnly) return;
        await updateDoc(doc(db, "annotations", annotationId), {
            tag_id: newTagId,
            updated_at: new Date().toISOString()
        });
        setEditMenuOpen(false);
        setSelectedAnnotation(null);
    };

    const handleHighlightClick = (e: React.MouseEvent, annotation: Annotation) => {
        if (isEditing || readOnly) return;
        e.stopPropagation();

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setEditMenuPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom + window.scrollY
        });
        setSelectedAnnotation(annotation);
        setEditMenuOpen(true);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "papers", paperId), {
                abstract_text: editText
            });
            if (onUpdate) {
                onUpdate(editText);
            }
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating abstract:", error);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    // Rendering Logic: Split text into segments based on annotations
    const renderText = () => {
        // Sort annotations by start_index
        const sortedAnns = [...annotations].sort((a, b) => a.start_index - b.start_index);

        // Flatten overlapping annotations? For MVP, let's assume no overlap or just render linearly.
        // If overlap exists, this simple logic might break or look weird.
        // A better approach for rendering is to build a list of "segments".

        interface Segment {
            text: string;
            type: "text" | "highlight";
            id: string;
            tagId?: string;
        }

        let lastIndex = 0;
        const segments: Segment[] = [];

        sortedAnns.forEach((ann) => {
            // If there's a gap before this annotation
            if (ann.start_index > lastIndex) {
                segments.push({
                    text: text.slice(lastIndex, ann.start_index),
                    type: "text",
                    id: `text-${lastIndex}`,
                });
            }

            // The annotation itself
            // Check if we are already past this annotation (overlap case)
            if (ann.end_index > lastIndex) {
                const start = Math.max(ann.start_index, lastIndex);
                const end = ann.end_index; // Assuming no nested overlap for now

                segments.push({
                    text: text.slice(start, end),
                    type: "highlight",
                    id: ann.id,
                    tagId: ann.tag_id,
                });

                lastIndex = end;
            }
        });

        // Remaining text
        if (lastIndex < text.length) {
            segments.push({
                text: text.slice(lastIndex),
                type: "text",
                id: `text-${lastIndex}`,
            });
        }

        return segments.map((seg) => {
            if (seg.type === "highlight") {
                const tag = tags[seg.tagId!];
                return (
                    <span
                        key={seg.id}
                        className={`px-1 rounded ${readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'}`}
                        style={{ backgroundColor: tag?.color || "#ddd" }}
                        title={tag?.label}
                        onClick={(e) => {
                            if (!readOnly) {
                                const ann = annotations.find(a => a.id === seg.id);
                                if (ann) handleHighlightClick(e, ann);
                            }
                        }}
                    >
                        {seg.text}
                    </span>
                );
            }
            return <span key={seg.id}>{seg.text}</span>;
        });
    };

    return (
        <div className="relative">
            <div className="bg-white rounded-lg shadow-sm min-h-[500px] p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Abstract</h3>
                    {isEditing && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditText(text); }}>
                                <X size={16} className="mr-1" /> Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                                <Save size={16} className="mr-1" /> {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 min-h-[400px] text-lg leading-relaxed resize-none border-0 focus-visible:ring-0 p-0"
                    />
                ) : (
                    <div
                        ref={textRef}
                        className="text-lg leading-relaxed whitespace-pre-wrap flex-1"
                        onMouseUp={handleMouseUp}
                    >
                        {renderText()}
                    </div>
                )}

                {!isEditing && !readOnly && (
                    <div className="mt-4 pt-4 border-t flex justify-start">
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            <Pencil size={14} className="mr-2" /> Edit Text
                        </Button>
                    </div>
                )}
            </div>

            {/* Custom Popover/Menu positioned absolutely */}
            {popoverOpen && !isEditing && (
                <div
                    className="fixed z-50 bg-white shadow-xl rounded-lg border p-2 flex gap-2 flex-wrap max-w-[300px]"
                    style={{ top: popoverPosition.y, left: popoverPosition.x, transform: "translate(-50%, -100%)" }}
                >
                    {Object.values(tags).map((tag) => (
                        <button
                            key={tag.id}
                            className="px-3 py-1 rounded-full text-xs font-medium text-white hover:scale-105 transition-transform"
                            style={{ backgroundColor: tag.color }}
                            onClick={() => handleAddAnnotation(tag.id)}
                        >
                            {tag.label}
                        </button>
                    ))}
                    {Object.keys(tags).length === 0 && (
                        <span className="text-xs text-gray-500 p-1">No tags created yet.</span>
                    )}
                </div>
            )}

            {/* Edit Menu for existing highlights */}
            {editMenuOpen && selectedAnnotation && !isEditing && (
                <div
                    className="fixed z-50 bg-white shadow-xl rounded-lg border overflow-hidden"
                    style={{ top: editMenuPosition.y + 8, left: editMenuPosition.x, transform: "translateX(-50%)" }}
                >
                    <div className="p-2 border-b bg-gray-50">
                        <p className="text-xs font-semibold text-gray-600">Change Tag</p>
                    </div>
                    <div className="p-2 flex gap-2 flex-wrap max-w-[300px]">
                        {Object.values(tags)
                            .filter(tag => tag.id !== selectedAnnotation.tag_id)
                            .map((tag) => (
                                <button
                                    key={tag.id}
                                    className="px-3 py-1 rounded-full text-xs font-medium text-white hover:scale-105 transition-transform"
                                    style={{ backgroundColor: tag.color }}
                                    onClick={() => handleChangeTag(selectedAnnotation.id, tag.id)}
                                >
                                    {tag.label}
                                </button>
                            ))}
                    </div>
                    <div className="border-t">
                        <button
                            className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                            onClick={() => handleDeleteAnnotation(selectedAnnotation.id)}
                        >
                            Delete Highlight
                        </button>
                    </div>
                    <div className="border-t">
                        <button
                            className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
                            onClick={() => {
                                setEditMenuOpen(false);
                                setSelectedAnnotation(null);
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
