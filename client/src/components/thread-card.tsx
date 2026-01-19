import React from 'react';
import { MessageSquare, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ForumThread } from '../lib/types'; // Import the updated type

interface ThreadCardProps {
    thread: ForumThread; // Use the updated type
    onClick?: () => void;
}

export function ThreadCard({ thread, onClick }: ThreadCardProps) {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getInitials = (name: string | undefined): string => {
        if (!name) return '??';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Use correct property names from backend data
    const replyCount = Number(thread.reply_count || 0); // Convert to number if needed
    const isResolved = thread.is_resolved;

    // Adjust logic based on available data
    const isHot = replyCount > 5;
    const needsHelp = !isResolved && replyCount === 0;

    return (
        <Card
            className="p-5 cursor-pointer group transition-all hover:shadow-lg hover:border-primary/20"
            onClick={onClick}
        >
            <div className="flex gap-4">
                {/* Avatar - Use creator.avatar_url */}
                <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={thread.creator?.avatar_url} /> {/* Use creator.avatar_url */}
                    <AvatarFallback>
                        {getInitials(thread.creator?.name)} {/* Use creator.name */}
                    </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="line-clamp-2 group-hover:text-primary transition-colors mb-1 font-medium"> {/* Added font-medium */}
                                {thread.title}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{thread.creator?.name}</span> {/* Use creator.name */}
                                <span>•</span>
                                <span>{formatDate(thread.created_at)}</span>
                            </div>
                        </div>

                        {/* Status Badge - Use is_resolved */}
                        {isResolved && (
                            <Badge variant="outline" className="shrink-0 border-green-200 bg-green-50 text-green-700 font-normal text-xs px-1.5 py-0.5"> {/* Adjusted styling */}
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Solved
                            </Badge>
                        )}
                    </div>

                    {/* Body Preview - Optional: Only show if body exists */}
                    {thread.body && (
                         <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {thread.body}
                         </p>
                    )}


                    {/* Tags - Optional: Only show if tags exist and array has items */}
                    {thread.tags && thread.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {thread.tags.map((tag, index) => (
                                <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-xs font-normal" // Use font-normal
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Footer Stats - Use replyCount */}
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageSquare className="w-4 h-4" />
                            {/* Use replyCount */}
                            <span>{replyCount} {replyCount === 1 ? 'answer' : 'answers'}</span> 
                        </div>

                        {needsHelp && (
                            <Badge variant="outline" className="text-xs font-normal"> {/* Use font-normal */}
                                Needs help
                            </Badge>
                        )}

                        {isHot && (
                            <Badge variant="outline" className="text-xs font-normal text-amber-700 border-amber-200 bg-amber-50"> {/* Example styling */}
                                Hot topic
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
