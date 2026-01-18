"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, RefreshCcw, AlertTriangle } from "lucide-react";

interface UserData {
    id: string;
    email: string;
    paperCount?: number;
}

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: UserData[];
    onResetData: (userId: string) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
}

export function UserManagementModal({ isOpen, onClose, users, onResetData, onDeleteUser }: UserManagementModalProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'reset' | 'delete', userId: string } | null>(null);

    const handleAction = async () => {
        if (!confirmAction) return;

        setLoadingId(confirmAction.userId);
        try {
            if (confirmAction.type === 'reset') {
                await onResetData(confirmAction.userId);
            } else {
                await onDeleteUser(confirmAction.userId);
            }
            setConfirmAction(null);
        } catch (error) {
            console.error(error);
            alert("Action failed");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Participants</DialogTitle>
                    <DialogDescription>
                        Reset data or remove users from the system.
                    </DialogDescription>
                </DialogHeader>

                {confirmAction ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                        <div className="p-3 bg-red-100 rounded-full">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Are you sure?</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                {confirmAction.type === 'reset'
                                    ? "This will permanently delete all papers, annotations, and tags for this user."
                                    : "This will permanently delete the user account and all associated data."}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={handleAction}
                                disabled={!!loadingId}
                            >
                                {loadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Papers</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.email}</TableCell>
                                        <TableCell>{user.paperCount || 0}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                onClick={() => setConfirmAction({ type: 'reset', userId: user.id })}
                                                disabled={!!loadingId}
                                            >
                                                <RefreshCcw size={14} className="mr-1" /> Reset Data
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setConfirmAction({ type: 'delete', userId: user.id })}
                                                disabled={!!loadingId}
                                            >
                                                <Trash2 size={14} className="mr-1" /> Delete User
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}

                {!confirmAction && (
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
