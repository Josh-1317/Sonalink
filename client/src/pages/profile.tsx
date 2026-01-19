import React, { useState, useEffect } from 'react'; // Added useState, useEffect
// Added Loader2
import { Mail, Calendar, Award, Upload, MessageSquare, Trophy, Loader2, Edit, Save, X } from 'lucide-react'; 
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { MaterialCard } from '../components/material-card';
import { ThreadCard } from '../components/thread-card';
import { useAuth } from '../lib/auth-context';
// Removed mock data imports
import axiosClient from '../api/axiosClient'; // Import API client
// Import types
import { User, Course, Material, ForumThread, ForumReply } from '../lib/types'; 
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';


// Define contribution types from backend response
interface Contributions {
    materials: Material[];
    threads: ForumThread[];
    replies: ForumReply[];
}

interface ProfilePageProps {
    onNavigate: (page: string) => void;
    userId?: number;
}

export function ProfilePage({ onNavigate, userId }: ProfilePageProps) {
    const { user: authUser, updateUser: updateAuthContextUser } = useAuth(); // Renamed to authUser
    const isOwnProfile = !userId || userId === authUser?.id;
    
    // --- State for fetched data ---
    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [contributions, setContributions] = useState<Contributions | null>(null);
    const [joinedCourses, setJoinedCourses] = useState<Course[]>([]);
    
    // --- State for UI ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', bio: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchData = async () => {
            // Determine whose profile to fetch
            const effectiveUserId = isOwnProfile ? authUser?.id : userId;
            if (!effectiveUserId) {
                // This can happen if viewing own profile but authUser isn't loaded yet
                // Or if viewing other profile and no userId is provided
                setIsLoading(false);
                return; 
            }

            setIsLoading(true);
            setError(null);
            
            try {
                let profilePromise;
                let contributionsPromise;
                let coursesPromise;

                if (isOwnProfile) {
                    // Fetching our own profile data
                    profilePromise = axiosClient.get<{ user: User }>('/users/me');
                    contributionsPromise = axiosClient.get<Contributions>('/users/me/contributions');
                    coursesPromise = axiosClient.get<Course[]>('/users/me/enrolled-courses');
                } else {
                    // Fetching someone else's public profile
                    profilePromise = axiosClient.get<{ user: User }>(`/users/${userId}`);
                    // TODO: Implement GET /api/users/:id/contributions for public contributions
                    contributionsPromise = Promise.resolve({ data: { materials: [], threads: [], replies: [] } }); 
                    coursesPromise = Promise.resolve({ data: [] }); // Don't show other user's courses
                }

                const [profileRes, contributionsRes, coursesRes] = await Promise.all([
                    profilePromise,
                    contributionsPromise,
                    coursesPromise
                ]);

                setProfileUser(profileRes.data.user);
                setContributions(contributionsRes.data);
                setJoinedCourses(coursesRes.data || []);
                
                // Set initial state for the edit form
                setEditData({ 
                    name: profileRes.data.user?.name || '', 
                    bio: profileRes.data.user?.bio || '' 
                });

            } catch (err) {
                console.error("Failed to fetch profile data:", err);
                setError("Could not load profile data. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        // Only fetch if we have an authUser (for 'isOwnProfile' check) or a userId
        if (authUser || userId) {
            fetchData();
        } else {
             setIsLoading(false); // No user, stop loading
        }
    // Re-run if the viewed userId changes (e.g., navigating from one profile to another)
    // or if the authUser changes (e.g., login/logout)
    }, [isOwnProfile, userId, authUser]);

    // --- Handlers for Editing Profile ---

    const handleEditToggle = () => {
        if (!isEditing && profileUser) {
            setEditData({ name: profileUser.name || '', bio: profileUser.bio || '' });
        }
        setIsEditing(!isEditing);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditData({ ...editData, [e.target.name]: e.target.value });
    };

    const handleProfileSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            // Use PUT /api/users/me (your route might be /profile, adjust if so)
            const response = await axiosClient.put<{ user: User }>('/users/me', {
                name: editData.name,
                bio: editData.bio,
            });
            
            setProfileUser(response.data.user); // Update local state
            updateAuthContextUser(response.data.user); // Update auth context
            setIsEditing(false); // Exit edit mode
        } catch (err) {
            console.error("Failed to save profile:", err);
            setError("Failed to save profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('avatar', file); // 'avatar' must match backend middleware

        try {
            // Use POST /api/users/me/avatar (your route might be /profile/avatar)
            const response = await axiosClient.post<{ avatar_url: string }>('/users/me/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const newAvatarUrl = response.data.avatar_url;
            
            // Update local state and auth context
            const updatedUser = { ...profileUser!, avatar_url: newAvatarUrl };
            setProfileUser(updatedUser);
            updateAuthContextUser(updatedUser);
            
        } catch (err: any) {
            console.error("Failed to upload avatar:", err);
            setError(err.response?.data?.message || "Failed to upload avatar. Please ensure it's an image.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- Helper Functions (from original) ---
    const getInitials = (name: string | undefined) => {
        if (!name) return 'U'; // Default if name is not yet loaded
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '...'; // Handle case where data might be loading
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // --- Render Logic ---

    if (isLoading) {
        return <div className="p-6 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
    }

    if (error) {
        return <div className="p-6 text-destructive text-center">{error}</div>;
    }

    if (!profileUser) {
         // This state could be hit if !isOwnProfile and the fetch failed, or no authUser and no userId
        return <div className="p-6 text-center text-muted-foreground">User not found.</div>;
    }
    
    // Calculate stats from fetched contributions data
    const userStats = {
        uploads: contributions?.materials.length || 0,
        answers: contributions?.replies.length || 0, // Used for "Posts"
        threads: contributions?.threads.length || 0, // Used for "Posts"
        quizzes: 0 // Backend endpoint for this is not built yet
    };

    // Use fetched data, fallback to empty arrays
    const userMaterials = contributions?.materials || [];
    const userThreads = contributions?.threads || [];
    const userReplies = contributions?.replies || []; // Added replies
    // joinedCourses is already fetched and in state

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Profile Header */}
            <Card className="p-8 mb-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Avatar - Now with upload functionality */}
                    <div className="relative group self-center md:self-start">
                        <Avatar className="w-24 h-24">
                            <AvatarImage src={profileUser.avatar_url || undefined} alt={profileUser.name} />
                            <AvatarFallback className="text-3xl">
                                {getInitials(profileUser.name)}
                            </AvatarFallback>
                        </Avatar>
                        {/* Show upload button only on own profile */}
                        {isOwnProfile && (
                             <label 
                                htmlFor="avatar-upload" 
                                className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ${isUploading ? 'opacity-100 cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? (
                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                ) : (
                                    <Upload className="w-6 h-6 text-white" />
                                )}
                                <input 
                                   id="avatar-upload" 
                                   type="file" 
                                   accept="image/*" 
                                   className="sr-only" 
                                   onChange={(e) => e.target.files && handleAvatarUpload(e.target.files[0])}
                                   disabled={isUploading} 
                                />
                            </label>
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                             {/* Content: Edit Mode or View Mode */}
                            {isEditing ? (
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <Label htmlFor="edit-name" className="text-xs">Name</Label>
                                        <Input 
                                            id="edit-name" 
                                            name="name" 
                                            value={editData.name} 
                                            onChange={handleInputChange} 
                                            disabled={isSaving}
                                            className="text-lg font-semibold p-0 border-0 border-b rounded-none focus-visible:ring-0"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="edit-bio" className="text-xs">Bio</Label>
                                        <Textarea 
                                            id="edit-bio" 
                                            name="bio" 
                                            value={editData.bio} 
                                            onChange={handleInputChange} 
                                            placeholder="Tell us a bit about yourself..." 
                                            rows={3}
                                            disabled={isSaving}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-2xl font-bold mb-1">{profileUser.name}</h1>
                                    <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-sm">{profileUser.email}</span>
                                    </div>
                                    <p className="text-muted-foreground mb-4 max-w-prose">
                                        {profileUser.bio || (isOwnProfile ? 'You have not set a bio yet.' : 'No bio available.')}
                                    </p>
                                </div>
                            )}

                            {/* Edit/Save Buttons */}
                            {isOwnProfile && (
                                <div className="flex gap-2">
                                     {isEditing ? (
                                        <>
                                            <Button variant="ghost" size="sm" onClick={handleEditToggle} disabled={isSaving}>Cancel</Button>
                                            <Button size="sm" onClick={handleProfileSave} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                                Save
                                            </Button>
                                        </>
                                     ) : (
                                        // This is your original Edit button logic, but I'm adding the
                                        // handleEditToggle function instead of navigating away.
                                        // Change onClick back to () => onNavigate('settings') if you prefer that.
                                        <Button variant="outline" size="sm" onClick={handleEditToggle}>
                                            <Edit className="w-3 h-3 mr-2" />
                                            Edit Profile
                                        </Button>
                                     )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 max-w-md w-full md:w-auto">
                        <Card className="p-4 text-center">
                            <div className="flex items-center justify-center mb-1">
                                <Upload className="w-4 h-4 text-primary" />
                            </div>
                            {/* Use calculated stats */}
                            <div className="text-lg font-bold mb-1">{userStats.uploads}</div>
                            <div className="text-xs text-muted-foreground">Uploads</div>
                        </Card>
                        <Card className="p-4 text-center">
                            <div className="flex items-center justify-center mb-1">
                                <MessageSquare className="w-4 h-4 text-primary" />
                            </div>
                             {/* Use calculated stats */}
                            <div className="text-lg font-bold mb-1">{userStats.threads + userStats.answers}</div>
                            <div className="text-xs text-muted-foreground">Posts</div>
                        </Card>
                        <Card className="p-4 text-center">
                            <div className="flex items-center justify-center mb-1">
                                <Trophy className="w-4 h-4 text-primary" />
                            </div>
                             {/* Use calculated stats */}
                            <div className="text-lg font-bold mb-1">{userStats.quizzes}</div>
                            <div className="text-xs text-muted-foreground">Quizzes</div>
                        </Card>
                    </div>

                     {/* Badges - Use real data */}
                    <div className="flex items-center gap-2 mt-4 md:mt-0 flex-wrap">
                        <Badge variant="secondary" className="capitalize">
                            <Award className="w-3 h-3 mr-1" />
                            {profileUser.role || 'Student'}
                        </Badge>
                        <Badge variant="outline">
                            <Calendar className="w-3 h-3 mr-1" />
                            {/* Use real created_at date */}
                            Joined {formatDate(profileUser.created_at)} 
                        </Badge>
                    </div>
                </div>
            </Card>

            {/* Content Tabs */}
            <Tabs defaultValue="materials">
                <TabsList>
                    {/* Use fetched data for counts */}
                    <TabsTrigger value="materials">Materials ({userMaterials.length})</TabsTrigger>
                    <TabsTrigger value="posts">Posts ({(userStats.threads + userStats.answers)})</TabsTrigger>
                    {isOwnProfile && <TabsTrigger value="courses">Courses ({joinedCourses.length})</TabsTrigger>}
                </TabsList>

                {/* Materials Tab - Use fetched userMaterials */}
                <TabsContent value="materials" className="mt-6">
                    {userMaterials.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {userMaterials.map(material => (
                                <MaterialCard
                                    key={material.id}
                                    material={material}
                                    // Navigate to material detail page
                                    onClick={() => onNavigate(`materials/${material.id}`)} 
                                />
                            ))}
                        </div>
                    ) : (
                        // Your original empty state (with the button)
                        <Card className="p-12 text-center">
                            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="mb-2 font-semibold">No materials yet</h3>
                            <p className="text-muted-foreground mb-6">
                                {isOwnProfile ? "You haven't uploaded any materials yet" : "This user hasn't uploaded any materials"}
                            </p>
                            {/* This button is from your original code */}
                            {isOwnProfile && (
                                // TODO: This '301' is hardcoded, maybe pop up a course selector?
                                // For now, it matches your original.
                                <Button onClick={() => onNavigate('course/301/materials')}>
                                    Upload Material
                                </Button>
                            )}
                        </Card>
                    )}
                </TabsContent>

                {/* Posts Tab - Use fetched userThreads and userReplies */}
                <TabsContent value="posts" className="mt-6">
                    {userThreads.length > 0 || userReplies.length > 0 ? (
                        <div className="space-y-6">
                            {userThreads.length > 0 && (
                                <div className="space-y-3">
                                     <h4 className="font-semibold text-lg">Threads Started</h4>
                                     {userThreads.map(thread => (
                                        <ThreadCard
                                            key={thread.id}
                                            thread={thread}
                                            // Ensure ThreadCard uses 'creator' object
                                            onClick={() => onNavigate(`forum/threads/${thread.id}`)}
                                        />
                                    ))}
                                </div>
                            )}
                             {userReplies.length > 0 && (
                                <div className="space-y-3">
                                     <h4 className="font-semibold text-lg">Replies Posted</h4>
                                     {userReplies.map(reply => (
                                         <Card key={reply.id} className="p-4 hover:bg-muted/50 cursor-pointer" onClick={() => onNavigate(`forum/threads/${reply.thread_id}`)}>
                                             {/* THIS IS THE LINE WITH THE TYPO */}
                                             <p className="text-sm text-muted-foreground">Replied to: <span className="font-medium text-primary">{reply.thread_title}</span></p>
                                             <p className="text-sm truncate mt-1">"{reply.body}"</p>
                                             <p className="text-xs text-muted-foreground mt-2">{formatDate(reply.created_at)}</p>
                                         </Card>
                                     ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Your original empty state
                        <Card className="p-12 text-center">
                            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="mb-2 font-semibold">No posts yet</h3>
                            <p className="text-muted-foreground">
                                {isOwnProfile ? "You haven't posted any discussions yet" : "This user hasn't posted any discussions"}
                            </p>
                        </Card>
                    )}
                </TabsContent>

                {/* Courses Tab - Use fetched joinedCourses */}
                {isOwnProfile && (
                    <TabsContent value="courses" className="mt-6">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {joinedCourses.map(course => (
                                <Card key={course.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => onNavigate(`course/${course.id}`)}>
                                    <div className="h-20 bg-primary rounded-lg mb-3 flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">{course.code}</span>
                                    </div>
                                    <h4 className="mb-1 font-semibold truncate">{course.name}</h4>
                                    {/* Your original did not show faculty, so this matches */}
                                    {/* <p className="text-sm text-muted-foreground">Prof. {course.faculty}</p> */}
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

