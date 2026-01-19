import React, { useState, useEffect, useCallback } from 'react';
// Added Loader2 and ScrollArea
import { Search, Bell, Settings, LogOut, User, Menu, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { SonaLinkLogo } from './sonalink-logo';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { ScrollArea } from './ui/scroll-area'; // Import ScrollArea
import { useAuth } from '../lib/auth-context';
import axiosClient from '../api/axiosClient'; // Import API client
import { debounce } from 'lodash'; // Import debounce utility (npm install lodash @types/lodash)

// Define Notification Type based on backend
interface Notification {
    id: number;
    type: string;
    message: string; // Renamed from 'body' in mock data
    is_read: boolean; // Renamed from 'isRead' in mock data
    related_resource_id: number | null;
    related_resource_type: string | null;
    created_at: string;
    // Removed 'link' field from mock data, will construct path based on type/id
}

// Define Suggestion Type based on backend
interface Suggestion {
    id: number;
    label: string;
    type: 'material' | 'course' | 'post' | 'user'; // Add more types if needed
    // Add meta info if backend provides it
    meta?: string; // Optional meta info from mock data
    course_id?: number; // Add if backend provides for navigation
}

interface AppHeaderProps {
    onNavigate: (page: string) => void;
    onSearchSubmit?: (query: string) => void; // Renamed from onSearch
    onMenuClick?: () => void;
}

// Renamed onSearch prop to onSearchSubmit
export function AppHeader({ onNavigate, onSearchSubmit, onMenuClick }: AppHeaderProps) {
    const { user, logout } = useAuth(); // User object now comes from context
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // --- State for fetched data ---
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    // -----------------------------

    // --- Fetch Notifications ---
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setIsLoadingNotifications(true);
        try {
            const response = await axiosClient.get<{ notifications: Notification[], pagination: { totalUnread: number } }>('/users/me/notifications');
            setNotifications(response.data.notifications || []);
            setUnreadCount(response.data.pagination.totalUnread || 0);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            // Optionally set an error state here
        } finally {
            setIsLoadingNotifications(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // --- Fetch Search Suggestions (Debounced) ---
    const fetchSuggestions = useCallback(
        debounce(async (query: string) => {
            if (query.trim().length < 2) {
                setSuggestions([]);
                setIsLoadingSuggestions(false);
                return;
            }
            setIsLoadingSuggestions(true);
            try {
                const response = await axiosClient.get<Suggestion[]>(`/search/suggestions?q=${encodeURIComponent(query)}`);
                // Add meta property if needed, otherwise map directly
                 setSuggestions(response.data.map(s => ({ ...s, meta: s.type === 'course' ? 'Course' : s.type === 'material' ? 'Material' : s.type === 'post' ? 'Post' : 'User' })) || []); // Example meta
            } catch (error) {
                console.error("Failed to fetch search suggestions:", error);
                setSuggestions([]);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300),
        []
    );

    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            fetchSuggestions(searchQuery);
            setShowSuggestions(true); // Show when fetching starts
        } else {
            setSuggestions([]);
            setShowSuggestions(false); // Hide if query is too short
            fetchSuggestions.cancel();
        }
        return () => {
            fetchSuggestions.cancel();
        };
    }, [searchQuery, fetchSuggestions]);


    const getInitials = (name: string | undefined): string => {
        if (!name) return '??';
        // Your original getInitials logic
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Renamed handleSearch to handleSearchSubmit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
            onSearchSubmit?.(trimmedQuery); // Use renamed prop
            onNavigate(`search?q=${encodeURIComponent(trimmedQuery)}`);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion: Suggestion) => {
        // Your original suggestion click logic (adjust paths as needed)
         let path = '';
         if (suggestion.type === 'material') {
             // Navigate directly to material detail page
             path = `materials/${suggestion.id}`;
         } else if (suggestion.type === 'course') {
             path = `course/${suggestion.id}`;
         } else if (suggestion.type === 'post') { // Assuming 'post' means thread
             path = `forum/threads/${suggestion.id}`;
         } else if (suggestion.type === 'user') { // Changed from 'person' to match backend
             path = `profile/${suggestion.id}`;
         }

         if (path) {
             onNavigate(path);
         }
        setShowSuggestions(false);
        setSearchQuery('');
    };

     // --- Added Notification Click Handler ---
     const handleNotificationClick = async (notification: Notification) => {
         let path = '';
         if (notification.related_resource_type === 'material' && notification.related_resource_id) {
             path = `materials/${notification.related_resource_id}`;
         } else if (notification.related_resource_type === 'thread' && notification.related_resource_id) {
             path = `forum/threads/${notification.related_resource_id}`;
         } // Add more types...

         if(path) onNavigate(path);

         if (!notification.is_read) {
             try {
                 await axiosClient.put(`/notifications/${notification.id}/read`);
                 setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
                 setUnreadCount(prev => Math.max(0, prev - 1));
             } catch (error) {
                 console.error("Failed to mark notification as read:", error);
             }
         }
     };

    const handleLogout = () => {
        logout();
        onNavigate('landing');
    };

    // --- Return original JSX structure ---
    return (
        <header className="border-b bg-background sticky top-0 z-40">
            <div className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* Mobile Menu Button - Original Structure */}
                    {onMenuClick && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onMenuClick}
                            className="lg:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                    )}

                    {/* Logo - Original Structure */}
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="flex items-center gap-1.5 shrink-0"
                        style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}
                    >
                        <SonaLinkLogo className="w-8 h-8" />
                        <span className="hidden sm:inline" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>SonaLink</span>
                    </button>
                </div>

                {/* Search with Suggestions - Original Structure */}
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl relative">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search materials, courses, posts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                             // Show suggestions on focus only if query is long enough
                            onFocus={() => searchQuery && searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Keep original blur
                            className="pl-10" // Keep original class
                        />
                         {/* Loading indicator */}
                         {isLoadingSuggestions && (
                             <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                         )}
                    </div>

                    {/* Search Suggestions Dropdown - Use fetched 'suggestions' */}
                    {/* Keep original structure, map over 'suggestions' */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg overflow-hidden z-50">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onMouseDown={() => handleSuggestionClick(suggestion)} // Use onMouseDown
                                    // Keep original classes
                                    className="w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left flex items-center gap-3 border-b last:border-b-0" 
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate font-medium">{suggestion.label}</div>
                                        {/* Keep original meta display */}
                                        {suggestion.meta && <div className="text-xs text-muted-foreground">{suggestion.meta}</div>}
                                    </div>
                                    <Badge variant="secondary" className="text-xs capitalize"> {/* Keep original badge */}
                                        {suggestion.type}
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    )}
                     {/* No results message - Keep original structure */}
                     {showSuggestions && suggestions.length === 0 && searchQuery.length >= 2 && !isLoadingSuggestions && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg p-4 text-sm text-muted-foreground z-50">
                             No results found.
                         </div>
                     )}
                </form>

                {/* Actions - Original Structure */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Notifications - Use fetched 'notifications' and 'unreadCount' */}
                    {/* Keep original Popover structure */}
                    <Popover onOpenChange={(open) => {if(open) fetchNotifications()}}>
                        <PopoverTrigger asChild>
                            {/* Keep original Button */}
                            <Button variant="ghost" size="icon" className="relative">
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <Badge
                                        variant="destructive"
                                        // Keep original classes
                                        className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs" 
                                    >
                                        {unreadCount > 9 ? '9+' : unreadCount} 
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                            {/* Keep original header */}
                            <div className="p-4 border-b"> 
                                <h4 className="font-medium">Notifications</h4> 
                            </div>
                            {/* Use ScrollArea */}
                            <ScrollArea className="max-h-96"> 
                                {isLoadingNotifications ? (
                                     <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>
                                ) : notifications.length > 0 ? (
                                    // Map over fetched 'notifications'
                                    notifications.map((notification) => ( 
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)} // Use handler
                                            // Keep original classes, use is_read
                                            className={`w-full p-4 text-left hover:bg-muted transition-colors border-b last:border-b-0 ${
                                                !notification.is_read ? 'bg-primary/5 font-semibold' : '' 
                                            }`}
                                        >
                                            {/* Use message, not body */}
                                            <p className="text-sm mb-1">{notification.message}</p> 
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(notification.created_at).toLocaleString()}
                                            </p>
                                        </button>
                                    ))
                                ) : (
                                    // Keep original "No notifications" message
                                    <div className="p-8 text-center text-sm text-muted-foreground"> 
                                        No notifications yet
                                    </div>
                                )}
                            </ScrollArea>
                             {/* Optional Footer */}
                             <div className="p-2 border-t text-center">
                                 <Button variant="link" size="sm" onClick={() => onNavigate('notifications')}>
                                     View All
                                 </Button>
                             </div>
                        </PopoverContent>
                    </Popover>

                    {/* Profile Menu - Use fetched 'user' data */}
                    {/* Keep original DropdownMenu structure */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             {/* Keep original Button */}
                             <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 md:h-auto md:w-auto md:px-2 md:gap-2"> 
                                <Avatar className="w-8 h-8">
                                    <AvatarImage src={user?.avatar_url} /> {/* Use avatar_url */}
                                    <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                                </Avatar>
                                {/* Keep original span */}
                                <span className="hidden md:inline text-sm font-medium">{user?.name}</span> 
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 mt-1"> 
                             {/* Keep original Label */}
                             <DropdownMenuLabel className="font-normal"> 
                                 <div className="flex flex-col space-y-1">
                                     <p className="text-sm font-medium leading-none">{user?.name}</p>
                                     <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                 </div>
                             </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                             {/* Keep original MenuItems */}
                            <DropdownMenuItem onClick={() => onNavigate('profile')}>
                               <User className="w-4 h-4 mr-2" />
                               Profile
                           </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onNavigate('settings')}>
                               <Settings className="w-4 h-4 mr-2" />
                               Settings
                           </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10"> 
                               <LogOut className="w-4 h-4 mr-2" />
                               Logout
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

