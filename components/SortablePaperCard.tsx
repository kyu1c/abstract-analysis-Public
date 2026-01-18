import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PaperCard } from "./PaperCard";

interface Paper {
    id: string;
    title: string;
    abstract_text: string;
}

interface SortablePaperCardProps {
    paper: Paper;
    index: number;
    isDeleteMode: boolean;
    onDelete: (id: string) => void;
}

export function SortablePaperCard({ paper, index, isDeleteMode, onDelete }: SortablePaperCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: paper.id, disabled: isDeleteMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDeleteMode ? "default" : "grab",
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="h-full">
            <PaperCard paper={paper} index={index} isDeleteMode={isDeleteMode} onDelete={onDelete} />
        </div>
    );
}
