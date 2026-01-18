export interface TagGroup {
    name: string;
    tags: string[];
}

export function groupTags(tags: string[], threshold: number = 3): TagGroup[] {
    const groups: TagGroup[] = [];
    const visited = new Set<string>();

    // Sort tags by length (descending) so longer, more specific tags might serve as group names? 
    // Or just alphabetical? Let's do alphabetical for stability.
    const sortedTags = [...tags].sort();

    for (const tag of sortedTags) {
        if (visited.has(tag)) continue;

        const currentGroup: TagGroup = {
            name: tag, // The first tag found becomes the group name
            tags: [tag]
        };
        visited.add(tag);

        for (const otherTag of sortedTags) {
            if (visited.has(otherTag)) continue;

            if (areTagsSimilar(tag, otherTag, threshold)) {
                currentGroup.tags.push(otherTag);
                visited.add(otherTag);
            }
        }
        groups.push(currentGroup);
    }

    return groups;
}

function areTagsSimilar(s1: string, s2: string, threshold: number): boolean {
    // 1. Case insensitive check
    if (s1.toLowerCase() === s2.toLowerCase()) return true;

    // 2. Substring check (e.g. "Method" in "Methodology")
    if (s1.toLowerCase().includes(s2.toLowerCase()) || s2.toLowerCase().includes(s1.toLowerCase())) return true;

    // 3. Levenshtein Distance
    const dist = levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
    return dist <= threshold;
}

function levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
