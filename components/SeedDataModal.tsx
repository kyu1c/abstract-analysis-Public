"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, X } from "lucide-react";

interface SeedDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: { id: string; email: string }[];
    onSeed: (options: SeedOptions) => Promise<void>;
}

export interface SeedOptions {
    targetUserId: string;
    tags: { label: string; color: string }[];
    includeHighlights: boolean;
    smartHighlights: boolean;
}

const DEFAULT_TAGS = [
    { label: "Problem", color: "#EF4444" },
    { label: "Method", color: "#3B82F6" },
    { label: "Result", color: "#10B981" },
    { label: "Insight", color: "#F59E0B" },
    { label: "Future Work", color: "#8B5CF6" }
];

export function SeedDataModal({ isOpen, onClose, users, onSeed }: SeedDataModalProps) {
    const [targetUserId, setTargetUserId] = useState<string>("");
    const [tags, setTags] = useState(DEFAULT_TAGS);
    const [includeTags, setIncludeTags] = useState(true);
    const [includeHighlights, setIncludeHighlights] = useState(true);
    const [smartHighlights, setSmartHighlights] = useState(true);
    const [loading, setLoading] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setTags(DEFAULT_TAGS);
            setIncludeTags(true);
            setIncludeHighlights(true);
            setSmartHighlights(true);
            setLoading(false);
            if (users.length > 0 && !targetUserId) {
                setTargetUserId(users[0].id);
            }
        }
    }, [isOpen, users]);

    const handleAddTag = () => {
        setTags([...tags, { label: "New Tag", color: "#000000" }]);
    };

    const handleRemoveTag = (index: number) => {
        const newTags = [...tags];
        newTags.splice(index, 1);
        setTags(newTags);
    };

    const handleTagChange = (index: number, field: 'label' | 'color', value: string) => {
        const newTags = [...tags];
        newTags[index] = { ...newTags[index], [field]: value };
        setTags(newTags);
    };

    const handleSeed = async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            await onSeed({
                targetUserId,
                tags: includeTags ? tags : [],
                includeHighlights: includeTags && includeHighlights, // Highlights require tags
                smartHighlights
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Seed Test Data</DialogTitle>
                    <DialogDescription>
                        Add 5 test papers and configure annotations.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6 py-4">
                        {/* User Selection */}
                        <div className="space-y-2">
                            <Label>Target User</Label>
                            <Select value={targetUserId} onValueChange={setTargetUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tag Configuration */}
                        <div className="space-y-4 border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Tags</Label>
                                <Switch checked={includeTags} onCheckedChange={setIncludeTags} />
                            </div>

                            {includeTags && (
                                <div className="space-y-2">
                                    {tags.map((tag, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={tag.label}
                                                onChange={(e) => handleTagChange(index, 'label', e.target.value)}
                                                placeholder="Label"
                                                className="flex-1"
                                            />
                                            <Input
                                                type="color"
                                                value={tag.color}
                                                onChange={(e) => handleTagChange(index, 'color', e.target.value)}
                                                className="w-12 p-1 h-10"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTag(index)}>
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={handleAddTag} className="w-full mt-2">
                                        <Plus size={16} className="mr-2" /> Add Tag
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Highlight Configuration */}
                        {includeTags && (
                            <div className="space-y-4 border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-semibold">Generate Highlights</Label>
                                        <p className="text-xs text-muted-foreground">Create random highlights using tags</p>
                                    </div>
                                    <Switch checked={includeHighlights} onCheckedChange={setIncludeHighlights} />
                                </div>

                                {includeHighlights && (
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="space-y-0.5">
                                            <Label>Smart Analysis</Label>
                                            <p className="text-xs text-muted-foreground">Try to match tags to relevant text</p>
                                        </div>
                                        <Switch checked={smartHighlights} onCheckedChange={setSmartHighlights} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSeed} disabled={loading || !targetUserId}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Seed Data
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
