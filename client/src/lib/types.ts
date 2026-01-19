// SonaLink TypeScript Types

// --- USER TYPES ---
export interface User {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null; // Changed from avatar?
    bio: string | null;        // Changed from bio?
    role: 'student' | 'faculty' | 'admin'; // Added based on backend implementation
    created_at: string;      // Added, often useful
    // joinedCourses and stats are usually fetched separately, not part of the core user object
}

// --- COURSE TYPES ---
export interface Course {
    id: number;
    code: string;
    name: string;
    faculty: string | null;     // Changed from string to allow null
    description: string | null; // Changed from description?
    member_count?: number;    // Added '?': Only included in GET /courses/:id, not GET /courses
    // joined?: boolean; // This is usually determined contextually on the frontend, not sent by backend for general lists
}

// --- MATERIAL TYPES ---
export interface MaterialUploader { // Extracted for clarity
    id: number;
    name: string;
    avatar_url: string | null; // Changed from avatar?
}

export interface Material {
    id: number;
    title: string;
    description: string | null;   // Changed from description?
    file_url: string;
    // preview_url?: string; // Backend doesn't explicitly send this
    file_type: string | null;       // Changed from specific enum to string | null
    file_public_id?: string;    // Added, useful for some operations
    original_filename: string | null; // Added
    uploader: MaterialUploader;   // Use the nested type
    tags: string[];             // Correct
    upvotes: number;            // Correct
    downloads: number;          // Correct
    created_at: string;         // Correct
    course_id: number;          // Added (was optional before)
    // Course details usually fetched separately or included if needed
    course_code?: string;
    course_name?: string;
}

// --- FORUM TYPES ---
// Matches the creator object structure used elsewhere
export interface ForumUserSummary {
    id: number;
    name: string;
    avatar_url: string | null;
}

export interface ForumThread {
    id: number;
    title: string;
    body: string | null;        // Changed from string to allow null
    creator: ForumUserSummary;  // Changed from 'user'
    // tags: string[];          // Backend getAllThreads/getThread doesn't include tags currently
    reply_count: string | number; // Changed from answers_count, backend sends string from COUNT(*)
    is_resolved: boolean;       // Changed from accepted?
    created_at: string;
    course_id: number;
}

export interface ForumReply {
    id: number;
    body: string;
    creator: ForumUserSummary; // Changed from 'user'
    created_at: string;
    is_accepted_answer: boolean; // Changed from is_accepted?
    thread_id: number;         // Added, useful context
}

// --- QUIZ TYPES ---
export interface Quiz {
    id: number;
    title: string;
    description: string | null; // Changed from description?
    course_id: number;
    creator_id: number;       // Changed from nested object (creator info fetched separately if needed)
    time_limit_minutes: number | null; // Changed from optional number
    due_date: string | null;           // Changed from optional string
    created_at: string;
    updated_at: string | null; // Changed from optional string
    // Frontend-specific fields fetched separately:
    course_name?: string;     // Fetched in GET /quizzes/:id
    total_questions?: string | number; // Fetched in GET /courses/:id/quizzes
    submitted_count?: string | number; // Fetched in GET /courses/:id/quizzes
}

export interface QuizQuestion {
    id: number;
    question_text: string; // Renamed from question
    question_type: 'multiple_choice_single' | 'multiple_choice_multiple' | 'true_false' | 'short_answer'; // Match backend enum
    points: number;
    order_index: number;
    options: QuestionOption[]; // Changed structure
}

export interface QuestionOption { // New interface for options
    id: number;
    option_text: string;
    // is_correct is NOT sent to student when viewing quiz questions initially
}

export interface QuizSubmission { // Added type for submission results
    id: number;
    quiz_id: number;
    user_id: number;
    score: number | null;
    max_possible_score: number | null;
    submitted_at: string | null;
    quiz_title?: string; // Added from GET /submissions/:id
}

export interface SubmissionAnswer { // Added type for submission results
    answer_id: number;
    question_id: number;
    selected_option_ids: number[] | null;
    answer_text: string | null;
    is_correct: boolean | null; // Can be null if not auto-graded
    points_awarded: number;
    question_text: string;
    question_type: string;
    // correct_option_ids?: number[]; // Optionally include correct answer for review
}


// --- NOTIFICATION TYPES ---
export interface Notification {
    id: number;
    user_id?: number; // Backend doesn't usually return this on GET /me/notifications
    type: string; // Allow more flexibility than strict enum initially
    message: string; // Renamed from body
    is_read: boolean; // Renamed from isRead
    related_resource_id: number | null;
    related_resource_type: string | null;
    created_at: string;
    // 'link' is constructed on the frontend based on type/id
}

// --- SEARCH TYPES ---
export interface SearchSuggestion {
    id: number;
    label: string;
    type: 'material' | 'course' | 'post' | 'user'; // Matches backend implementation
    // meta?: string; // Backend currently doesn't provide meta
}

export interface FullSearchResults { // Structure returned by GET /api/search
    materials: Material[]; // Use the detailed Material type
    courses: Course[]; // Use the Course type
    // users: UserSummary[]; // Add later
    // posts: ForumThread[]; // Add later
    pagination: PaginationMetadata;
}


// --- UTILITY TYPES ---
export interface PaginationMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
    totalUnread?: number; // Specific to notifications endpoint
}

// Type for responses that include paginated items
export interface PaginatedResponse<T> {
    items: T[];
    pagination: PaginationMetadata;
}

// --- Comment & Announcement Types (Based on Docs - Not Implemented Yet) ---
// These remain as defined, assuming they match future backend plans
export interface Comment {
    id: number;
    body: string;
    user: {
        id: number;
        name: string;
        avatar?: string; // Should likely be avatar_url
    };
    created_at: string;
}

export interface Announcement {
    id: number;
    title: string;
    body: string;
    course_id: number;
    created_at: string;
}


// --- API Endpoints Documentation Review ---
/**
 * SonaLink API Endpoints Documentation (Review vs Implementation)
 *
 * BASE_URL: http://localhost:3001/api (Actual base)
 *
 * === AUTHENTICATION === ✅ (Mostly matches implementation)
 * POST /auth/signup: Response is { message, user: { id, name, email } } (Not just user_id)
 * GET /auth/verify: Response is HTML success message (Not JSON)
 * POST /auth/login: Response is { token, user: { id, name, email, avatar_url, role } }
 * POST /auth/resend-verification: Implemented, response matches doc.
 * POST /auth/forgot-password: Implemented, response matches doc.
 * POST /auth/reset-password: Implemented, response matches doc.
 *
 * === COURSES === ✅ (Mostly matches implementation)
 * GET /courses: Response is Course[] (Not PaginatedResponse)
 * GET /courses/:id: Implemented, response matches doc.
 * POST /courses/:id/join: Implemented, response is { message } (Not joined boolean). Unenroll endpoint also exists.
 * GET /courses/:id/members: Implemented, response is { members: UserSummary[], courseId }. (Not PaginatedResponse, no search/sort yet).
 * POST/PUT/DELETE /courses: NOT implemented (Admin/Faculty feature).
 *
 * === MATERIALS === ✅ (Mostly matches implementation)
 * GET /courses/:id/materials: Implemented. Response is PaginatedResponse<{items: Material[], pagination: {...}}>. Supports ?tag= & ?sort=top|most_downloaded|recent. Uploader is nested object.
 * POST /courses/:id/materials: Implemented. Response is Material (Not {material: Material}). Expects 'materialFile' field name.
 * GET /materials/:id: Implemented. Response is Material. (Comments not implemented yet).
 * POST /materials/:id/upvote: Implemented. Response is { message, upvotes }. (user_voted not included).
 * GET /materials/:id/download: Implemented. Response is a redirect to a signed Cloudinary URL.
 * POST /materials/:id/comments: NOT implemented.
 * GET /materials (Global list): Implemented. Response is PaginatedResponse<{items: Material[], pagination: {...}}>. Supports ?sort= & ?tag=.
 *
 * === FORUM === ✅ (Matches implementation)
 * GET /courses/:id/forum: Implemented as listThreadsForCourse. Response is { threads: ForumThread[] }. (No pagination/filters yet).
 * POST /courses/:id/forum: Implemented as createThread. Response is { message, thread: ForumThread }.
 * GET /forum/threads/:threadId: Implemented as getThreadWithReplies. Response is { thread: ForumThread, replies: ForumReply[] }.
 * POST /forum/threads/:threadId/replies: Implemented as createReply. Response is { message, reply: ForumReply }.
 * PUT /forum/replies/:replyId/accept: Implemented as acceptAnswer. Response is { message, reply: {id, is_accepted_answer}, threadResolved }. (Not POST, used PUT. Response shape differs).
 * GET /forum/threads (Global list): Implemented as getAllThreads. Response is { threads: ForumThread[], pagination: {...} }. Supports ?sort= & pagination.
 *
 * === QUIZZES === ✅ (Mostly matches implementation)
 * GET /courses/:id/quizzes: Implemented as listQuizzesForCourse. Response is { quizzes: Quiz[] }. (Not PaginatedResponse yet). Includes submitted_count.
 * POST /courses/:id/quizzes: Implemented as createQuiz (no role check yet). Response is { message, quiz: Quiz }. (Doesn't accept questions array during creation).
 * GET /quizzes/:id: Implemented as getQuizWithQuestions. Response is { quiz: Quiz, questions: QuizQuestion[] } (options included, no correct answer).
 * POST /quizzes/:id/submit: Implemented as submitQuiz. Response is { message, submissionId, score, maxPossibleScore }. (Doesn't return correct_answers).
 * GET /quizzes/:id/leaderboard: NOT implemented.
 * GET /submissions/:submissionId: Implemented as getSubmissionResult. Response is { submission: QuizSubmission, answers: SubmissionAnswer[] }.
 *
 * === SEARCH === ✅ (Matches implementation)
 * GET /search: Implemented as getFullSearchResults. Response is { materials: [], courses: [], pagination: {...} }. (Doesn't include posts/people yet).
 * GET /search/suggestions: Implemented as getSearchSuggestions. Response is SearchSuggestion[]. (Not nested under 'suggestions' key).
 *
 * === PROFILE === ✅ (Mostly matches implementation)
 * GET /profile/:userId --> Implemented as GET /users/:id (getUserProfile). Response is { user: PublicUser }. (Doesn't include materials/posts/courses).
 * PUT /profile --> Implemented as PUT /users/me (updateUserProfile). Updates name/bio. Response is { message, user }.
 * POST /users/me/avatar: Implemented for avatar upload. Response is { message, avatar_url }. (Separate from PUT /profile).
 * GET /users/me: Implemented as getMe. Response is { user: User }.
 * GET /users/me/contributions: Implemented. Response is { materials: [], threads: [], replies: [] }.
 * GET /users/me/enrolled-courses: Implemented. Response is Course[].
 *
 * === NOTIFICATIONS === ✅ (Matches implementation)
 * GET /notifications --> Implemented as GET /users/me/notifications. Response is { notifications: Notification[], pagination: { totalItems, totalUnread } }. (No filter yet).
 * PUT /notifications/:id/read: Implemented as markAsRead. Response is { message, notification: {id, is_read} }.
 * PUT /notifications/read-all: NOT implemented.
 * DELETE /notifications/:id: NOT implemented.
 *
 * === SETTINGS === ❌ (Not implemented)
 * PUT /settings/password: Not implemented.
 * PUT /settings/notifications: Not implemented.
 */

// Added Comment and Announcement based on docs, ensure they match future backend
// export interface Comment { ... }
// export interface Announcement { ... }
