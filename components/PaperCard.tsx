import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Paper {
    id: string;
    title: string;
    abstract_text: string;
}

interface PaperCardProps {
    paper: Paper;
    index: number;
    isDeleteMode?: boolean;
    onDelete?: (id: string) => void;
}

export function PaperCard({ paper, index, isDeleteMode, onDelete }: PaperCardProps) {
    return (
        <div className="relative h-full group">
            {isDeleteMode && onDelete && (
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 z-20 h-8 w-8 rounded-full shadow-md"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(paper.id);
                    }}
                >
                    <Trash2 size={16} />
                </Button>
            )}
            <Link href={`/paper/${paper.id}`} className={isDeleteMode ? "pointer-events-none" : ""}>
                <Card className={`hover:shadow-lg transition-shadow cursor-pointer h-full ${isDeleteMode ? "opacity-80" : ""}`}>
                    <CardHeader>
                        <CardDescription className="font-bold text-primary mb-1">Paper #{index}</CardDescription>
                        <CardTitle className="text-xl line-clamp-2 leading-tight">{paper.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 line-clamp-3 text-sm">
                            {paper.abstract_text}
                        </p>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}
