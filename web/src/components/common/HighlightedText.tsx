/**
 * HighlightedText - Component for highlighting search matches
 */

interface HighlightedTextProps {
    text: string;
    searchQuery: string;
    className?: string;
}

export const HighlightedText = ({ text, searchQuery, className = '' }: HighlightedTextProps) => {
    if (!searchQuery.trim()) {
        return <span className={className}>{text}</span>;
    }

    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));

    return (
        <span className={className}>
            {parts.map((part, index) =>
                part.toLowerCase() === searchQuery.toLowerCase() ? (
                    <mark
                        key={index}
                        className="bg-yellow-200 dark:bg-yellow-600/40 text-gray-900 dark:text-gray-100 px-0.5 rounded"
                    >
                        {part}
                    </mark>
                ) : (
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    );
};
