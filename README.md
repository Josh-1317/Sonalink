# SonaLink — Peer-to-Peer Campus Hub

A modern, Gen-Z minimal academic collaboration platform for college students, featuring course-centric material sharing, peer Q&A forums, and interactive quizzes.

![SonaLink](https://img.shields.io/badge/version-1.0.0-blue) ![React](https://img.shields.io/badge/react-18.3.1-61DAFB) ![Tailwind](https://img.shields.io/badge/tailwind-4.0.0-38B2AC) ![TypeScript](https://img.shields.io/badge/typescript-5.6.2-3178C6)

## 🎯 Project Overview

SonaLink is a complete peer-to-peer campus hub designed for college students (Gen Z audience) focused on:
- **Collaboration**: Course-centric material sharing and discussion
- **Q&A**: Peer-driven forum with accepted answers
- **Quizzes**: Interactive quiz creation and challenges
- **Community**: Course-based communities with member profiles

## ✨ Key Features

### 🔐 Authentication
- College email signup with domain validation (`@sona.ac.in`)
- Email verification flow
- Password reset functionality
- Remember me option

### 📚 Course Management
- Searchable course catalog
- Join/leave courses
- Course dashboard with announcements
- Member directory with role badges

### 📄 Material Sharing
- Drag & drop file upload with progress tracking
- PDF/Document preview with toolbar
- Tag-based filtering and sorting
- Upvote system with optimistic UI
- Download tracking
- Comment threads

### 💬 Forum & Q&A
- Create threaded discussions
- Tag-based categorization
- Filter by unanswered/solved
- Accept best answers
- Reply with markdown support

### 🏆 Interactive Quizzes
- Multi-question quiz creation
- Multiple choice questions (4 options)
- Real-time quiz attempts
- Score calculation and results
- Leaderboard tracking

### 🔍 Global Search
- Search across materials, courses, posts, and people
- Real-time search suggestions (250ms debounce)
- Tabbed results with counts
- Keyboard navigation

### 👤 User Profiles
- Public profile pages
- Contribution statistics
- Uploaded materials and posts
- Joined courses

### 🔔 Notifications
- Real-time activity notifications
- Read/unread filtering
- Notification preferences
- Clear all functionality

### ⚙️ Settings
- Profile management
- Password change
- Notification preferences
- Avatar upload

## 🎨 Design System

### Colors
- **Primary**: `#2B8FA8` (Teal Blue) - Brand primary
- **Accent**: `#FFA10A` (Orange) - Secondary actions
- **Orange**: `#FFA10A` - Achievements/quizzes/accents
- **Background**: `#FAFAFA` - Light gray
- **Surface**: `#FFFFFF` - White cards
- **Text**: `#1F1F1F` / `#6B7280` - Primary/secondary
- **Muted**: `#E5E7EB` - Borders and dividers

### Gradient
```css
--hero-grad: linear-gradient(135deg, #2B8FA8 0%, #FFA10A 100%)
```
Used on hero sections, CTA buttons, and selective banners.

### Typography
- **Headings**: Poppins / Space Grotesk 600/700
- **Body**: Inter 400/500
- **Scale**: 14/16/20/28/36/48px

### Spacing
8-point grid: `4/8/16/24/32/48px`

### Border Radius
- Small: `8px`
- Medium: `12px`
- Large: `16px`

### Shadows
- **Soft**: `0 6px 20px rgba(16,24,40,0.06)`
- **Lift**: `0 12px 30px rgba(16,24,40,0.12)`

### Motion
- **Easing**: `cubic-bezier(0.2, 0.9, 0.2, 1)`
- **Durations**: `180ms / 300ms / 400ms`

### Micro-interactions
- **Card hover**: `translateY(-6px)` with shadow lift
- **Entrances**: Opacity + translateY fade-in
- **CTA hover**: Gradient pulse animation
- **Optimistic UI**: Immediate feedback with rollback on error

## 📱 Responsive Design

### Desktop (1440px+)
- Left sidebar navigation
- 3-column material grid
- Full feature set

### Mobile (390px)
- Drawer navigation (slide-in)
- Single column layouts
- FAB for primary actions
- Bottom sheets for filters

## 🛠 Tech Stack

### Frontend
- **React 18.3.1** - UI library
- **TypeScript 5.6.2** - Type safety
- **Tailwind CSS 4.0** - Utility-first styling
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **Motion (Framer Motion)** - Animations

### Component Library
- **shadcn/ui** - Pre-built accessible components
  - Buttons, Cards, Modals, Tabs
  - Forms, Inputs, Selects
  - Avatars, Badges, Progress bars
  - And 40+ more components

### State Management
- **React Context API** - Authentication state
- **useState/useEffect** - Component state
- **Optimistic UI** - Immediate feedback

## 📂 Project Structure

```
sonalink/
├── components/           # Reusable React components
│   ├── ui/              # shadcn/ui components
│   ├── app-header.tsx   # Global header with search
│   ├── app-sidebar.tsx  # Course navigation
│   ├── material-card.tsx
│   ├── course-card.tsx
│   ├── thread-card.tsx
│   ├── upload-dropzone.tsx
│   ├── pdf-preview.tsx
│   ├── quiz-create-modal.tsx
│   ├── quiz-attempt-modal.tsx
│   ├── tag-input.tsx
│   ├── fab.tsx
│   ├── loading-skeleton.tsx
│   └── empty-state.tsx
│
├── pages/               # Route components
│   ├── auth/           # Authentication pages
│   │   ├── signup.tsx
│   │   ├── verify.tsx
│   │   ├── login.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── course/         # Course-related pages
│   │   ├── course-hub.tsx
│   │   ├── materials-tab.tsx
│   │   ├── material-detail.tsx
│   │   ├── forum-tab.tsx
│   │   ├── members-tab.tsx
│   │   └── quizzes-tab.tsx
│   ├── landing.tsx
│   ├── onboarding.tsx
│   ├── dashboard.tsx
│   ├── search.tsx
│   ├── profile.tsx
│   ├── settings.tsx
│   ├── notifications.tsx
│   ├── admin.tsx
│   └── not-found.tsx
│
├── lib/                # Utilities and types
│   ├── auth-context.tsx
│   ├── types.ts        # TypeScript interfaces
│   └── mock-data.ts    # Development data
│
├── styles/
│   └── globals.css     # Global styles & tokens
│
├── App.tsx             # Router and app shell
├── API_DOCUMENTATION.md
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Modern web browser
- (Optional) Backend API running

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/sonalink.git
cd sonalink
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Open in browser**
```
http://localhost:3000
```

### Build for Production
```bash
npm run build
```

## 📖 Usage Guide

### User Flow

1. **Landing** → Sign up with college email
2. **Verify Email** → Check inbox and click verification link
3. **Onboarding** → Select courses to join
4. **Dashboard** → View joined courses and quick actions
5. **Course Hub** → Access materials, forum, members, quizzes
6. **Upload** → Share study materials with peers
7. **Forum** → Ask questions and get answers
8. **Quizzes** → Test knowledge and challenge friends

### Key Interactions

#### Upload Material
1. Click "Upload Material" button or FAB
2. Drag & drop file or browse
3. Add title, description, and tags
4. Submit and wait for progress to complete
5. View uploaded material in course materials tab

#### Create Quiz
1. Navigate to Quizzes tab
2. Click "Create Quiz"
3. Add title and description
4. Add questions with 4 options each
5. Select correct answer for each question
6. Submit to publish

#### Upvote Material (Optimistic UI)
1. View material detail
2. Click upvote button
3. See immediate feedback (optimistic)
4. Automatic rollback if API fails
5. Toast notification confirms success/failure

#### Search
1. Type in header search bar (250ms debounce)
2. View real-time suggestions
3. Click suggestion or press Enter
4. View tabbed results (All/Materials/Courses/Posts/People)

## 🎭 Mock Data

The application uses comprehensive mock data for development:
- **Courses**: 5 courses across different departments
- **Materials**: 12+ study materials with tags
- **Forum Threads**: 8 discussions with replies
- **Quizzes**: Sample quizzes with questions
- **Notifications**: Activity notifications
- **Users**: Multiple user profiles
