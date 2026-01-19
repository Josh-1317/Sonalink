import React, { useState, useEffect } from 'react';
import { Upload, MessageSquare, Trophy, Plus, Loader2 } from 'lucide-react'; // Added Loader2
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { MaterialCard } from '../components/material-card'; // Assuming this component is ready
import { ThreadCard } from '../components/thread-card'; // Assuming this component is ready
// Removed mock data imports
import { useAuth } from '../lib/auth-context';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import axiosClient from '../api/axiosClient'; // Import API client

// Define types to match backend data structure
interface Course {
    id: number;
    code: string;
    name: string;
    description?: string;
    member_count?: number; // Add if available from /enrolled-courses
}

interface Material {
    id: number;
    title: string;
    file_type: string | null;
    original_filename?: string;
    uploader: { id: number; name: string; avatar_url: string | null };
    tags: string[];
    upvotes: number;
    downloads: number;
    course_id: number; // Need course_id for navigation
    created_at: string;
    file_url: string; // Needed for potential thumbnail
    // Add thumbnail_url if backend provides it
}

interface Thread {
    id: number;
    title: string;
    // creator_name: string; // Remove this if it exists
    creator: { id: number; name: string; avatar_url: string | null }; // ADD/ENSURE THIS NESTED OBJECT
    reply_count: string | number;
    created_at: string;
    course_id: number;
    body?: string;
}

interface DashboardPageProps {
    onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth(); // Get user and auth loading status

    // State for fetched data
    const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
    const [recentThreads, setRecentThreads] = useState<Thread[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch data when component mounts and user is authenticated
    useEffect(() => {
        const fetchData = async () => {
            if (!isAuthenticated || !user) return; // Don't fetch if not logged in

            setIsLoadingData(true);
            setError(null);
            try {
                // Fetch all data concurrently
                const [coursesRes, materialsRes, threadsRes] = await Promise.all([
                    axiosClient.get<Course[]>(`/users/me/enrolled-courses`),
                    axiosClient.get<{ items: Material[], pagination: any }>(`/materials?sort=top&limit=3`),// Or a general materials endpoint sorted by votes/date
                    axiosClient.get<{ threads: Thread[], pagination: any }>(`/forum/threads?sort=recent&limit=2`)// Or a general threads endpoint sorted by date
                ]);

                setEnrolledCourses(coursesRes.data || []);
                // Adjust data access based on actual response structure
                setRecentMaterials(materialsRes.data.items || []); 
                setRecentThreads(threadsRes.data.threads || []);

            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
                setError("Could not load dashboard data. Please try again later.");
            } finally {
                setIsLoadingData(false);
            }
        };

        // Only fetch data once authentication check is complete and successful
        if (!isAuthLoading && isAuthenticated) {
            fetchData();
        } else if (!isAuthLoading && !isAuthenticated) {
            // Handle case where user is definitely not logged in (e.g., redirect)
             setIsLoadingData(false); // Not loading data if not authenticated
        }

    }, [isAuthenticated, isAuthLoading, user]); // Re-run if auth status changes

    // Quick Actions (can remain mostly static, adjust navigation if needed)
    const quickActions = [
        { icon: Upload, label: 'Upload Material', description: 'Share notes or resources', onClick: () => enrolledCourses.length > 0 ? onNavigate(`course/${enrolledCourses[0].id}/materials`) : alert("Join a course first!") },
        { icon: MessageSquare, label: 'Ask Question', description: 'Get help from peers', onClick: () => enrolledCourses.length > 0 ? onNavigate(`course/${enrolledCourses[0].id}/forum`) : alert("Join a course first!") },
        { icon: Trophy, label: 'View Quizzes', description: 'Test your knowledge', onClick: () => enrolledCourses.length > 0 ? onNavigate(`course/${enrolledCourses[0].id}/quizzes`) : alert("Join a course first!") } // Changed label/nav
    ];

    // Activity Feed & Stats remain mock data for now
    const activityFeed = [ /* ... mock data ... */ ];
    const stats = [ /* ... mock data ... */ ];

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    };

    // Loading state for the whole page
    if (isAuthLoading || isLoadingData) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }
    
    // Handle error state
     if (error) {
        return <div className="p-6 text-destructive">{error}</div>;
     }

    // Main component render
    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            {/* Welcome Banner */}
            <div className="mb-8 relative overflow-hidden rounded-xl shadow-lg">
                <div className="absolute inset-0 gradient-hero opacity-90 z-10" />
                <ImageWithFallback
                    src="https://images.unsplash.com/photo-1611764553921-437fb44f747a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                    alt="Workspace background"
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
                <div className="relative z-20 p-6 md:p-10 text-white">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 mb-4">
                        {/* Use avatar_url from user context */}
                        <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-white/30">
                            <AvatarImage src={user?.avatar_url} /> 
                            <AvatarFallback className="bg-white/20 text-xl md:text-2xl">
                                {user ? getInitials(user.name) : 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <h1 className="text-xl md:text-3xl mb-1 md:mb-2">
                                Welcome back, {user?.name?.split(' ')[0]}
                            </h1>
                            <p className="text-sm md:text-base text-white/90">
                                Here's what's happening with your courses today
                            </p>
                        </div>
                    </div>
                     {/* Streak Badge (Mock data) */}
                     {/* ... */}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mb-8">
                {/* Main Content - 2 cols */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Actions */}
                     {/* ... (Code remains the same, uses quickActions array) ... */}

                    {/* Top Materials */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2>Trending Materials</h2>
                            <Button variant="ghost" onClick={() => onNavigate('search')}>
                                View All
                            </Button>
                        </div>
                        {/* Use fetched recentMaterials */}
                        {recentMaterials.length > 0 ? (
                            <div className="grid md:grid-cols-3 gap-4">
                                {recentMaterials.map((material) => (
                                    <MaterialCard
                                        key={material.id}
                                        material={material}
                                        onClick={() => onNavigate(`materials/${material.id}`)} // Navigate directly to material detail
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card className="p-6 text-center text-muted-foreground">No trending materials yet.</Card>
                        )}
                    </div>

                    {/* Recent Discussions */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2>Recent Discussions</h2>
                            {/* Navigate to the first course's forum or a general forum page */}
                            <Button variant="ghost" onClick={() => enrolledCourses.length > 0 ? onNavigate(`course/${enrolledCourses[0].id}/forum`) : onNavigate('forum')}> 
                                View All
                            </Button>
                        </div>
                         {/* Use fetched recentThreads */}
                        {recentThreads.length > 0 ? (
                            <div className="space-y-3">
                                {recentThreads.map((thread) => (
                                    <ThreadCard
                                        key={thread.id}
                                        thread={thread}
                                        onClick={() => onNavigate(`forum/threads/${thread.id}`)} // Navigate directly to thread detail
                                    />
                                ))}
                            </div>
                         ) : (
                            <Card className="p-6 text-center text-muted-foreground">No recent discussions yet.</Card>
                         )}
                    </div>
                </div>

                {/* Sidebar - 1 col */}
                <div className="space-y-6">
                    {/* Activity Feed (Mock data) */}
                    {/* ... */}

                    {/* Your Courses */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3>Your Courses</h3>
                            <Badge variant="secondary">{enrolledCourses.length}</Badge>
                        </div>
                        {/* Use fetched enrolledCourses */}
                        {enrolledCourses.length > 0 ? (
                            <div className="space-y-3">
                                {enrolledCourses.map((course) => (
                                    <div
                                        key={course.id}
                                        onClick={() => onNavigate(`course/${course.id}`)} // Navigate to course hub
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
                                            <span className="text-xs font-semibold">{course.code}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate font-medium">{course.name}</p>
                                            {/* Display member count if available */}
                                            {/* <p className="text-xs text-muted-foreground">{course.member_count} members</p> */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                         ) : (
                             <p className="text-sm text-muted-foreground text-center py-4">You haven't joined any courses yet.</p>
                         )}
                        <Button
                            variant="outline"
                            className="w-full mt-4"
                            onClick={() => onNavigate('onboarding')} // Or a dedicated course discovery page
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Join More Courses
                        </Button>
                    </Card>

                    {/* Stats (Mock data) */}
                     {/* ... */}
                </div>
            </div>
        </div>
    );
}
