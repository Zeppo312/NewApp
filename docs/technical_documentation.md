# Wehen-Tracker App - Technical Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Overview](#project-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [File-by-File Documentation](#file-by-file-documentation)
6. [Authentication System](#authentication-system)
7. [Database Schema](#database-schema)
8. [Key Features](#key-features)
9. [Navigation Flow](#navigation-flow)
10. [UI Components](#ui-components)
11. [State Management](#state-management)
12. [API Integration](#api-integration)
13. [File Relationships and Dependencies](#file-relationships-and-dependencies)
14. [Development and Deployment](#development-and-deployment)

## Introduction

The Wehen-Tracker (Contraction Tracker) is a mobile application built with React Native and Expo, designed to help expectant mothers track contractions during pregnancy and provide baby development tracking after birth. The app features two distinct phases: pregnancy and post-birth, with different functionality available in each phase.

## Project Overview

The application serves as a comprehensive pregnancy and baby tracking tool with the following core functionalities:
- Contraction tracking with intensity indicators
- Hospital checklist management
- Birth plan creation and management
- Pregnancy countdown and information
- Baby diary and milestone tracking
- Daily activity tracking (feeding, diaper changes, etc.)
- Self-care tips and tracking for mothers

## Technology Stack

### Frontend
- **React Native**: Core framework for mobile app development
- **Expo**: Development platform for React Native
- **TypeScript**: Programming language for type-safe code
- **React Navigation**: Navigation library for screen management
- **Expo Router**: File-based routing system

### Backend
- **Supabase**: Backend-as-a-Service platform providing:
  - Authentication
  - PostgreSQL database
  - Storage for images and files
  - Realtime subscriptions

### Key Libraries
- `@react-navigation/bottom-tabs`: Tab-based navigation
- `@supabase/supabase-js`: Supabase client library
- `date-fns`: Date manipulation library
- `expo-image-picker`: Image selection from device
- `react-native-reanimated`: Advanced animations
- `react-native-gesture-handler`: Touch handling
- `react-native-svg`: SVG support for charts and graphics

## Project Structure

The project follows a feature-based structure with the following main directories:

### Root Directories
- `/app`: Main application screens and navigation
- `/assets`: Static assets like images and fonts
- `/components`: Reusable UI components
- `/constants`: Application constants and configuration
- `/contexts`: React context providers
- `/hooks`: Custom React hooks
- `/lib`: Utility functions and API clients
- `/supabase`: Supabase configuration and migrations
- `/types`: TypeScript type definitions

### App Directory Structure
- `/app/(auth)`: Authentication screens (login, registration)
- `/app/(tabs)`: Main application tabs for both pregnancy and post-birth phases
- `/app/(tabs-after-birth)`: Screens specific to the post-birth phase (currently empty, placeholder for future implementation)
- `/app/(tabs-before-birth)`: Screens specific to the pregnancy phase (currently empty, placeholder for future implementation)

### Key Files
- `app/_layout.tsx`: Main application layout and navigation setup
- `app/index.tsx`: Entry point that handles redirection based on authentication status
- `contexts/AuthContext.tsx`: Authentication state management
- `contexts/BabyStatusContext.tsx`: Baby birth status management
- `lib/supabase.ts`: Supabase client configuration and API functions
- `lib/baby.ts`: Baby-related data management functions

## File-by-File Documentation

This section provides a detailed overview of each file in the application, its purpose, and its relationships with other files.

### Root Layout and Navigation Files

#### `app/_layout.tsx`
- **Purpose**: Main application layout and entry point
- **Status**: Active, core file
- **Dependencies**:
  - `AuthProvider` from `contexts/AuthContext.tsx`
  - `BabyStatusProvider` from `contexts/BabyStatusContext.tsx`
  - `expo-router`, `expo-splash-screen`, `react-native-gesture-handler`
- **Description**: Sets up the root navigation structure using Stack Navigator, loads fonts, manages the splash screen, and wraps the application in the necessary context providers.

#### `app/index.tsx`
- **Purpose**: Main entry point that handles redirection based on authentication status
- **Status**: Active, core file
- **Dependencies**:
  - `useAuth` from `contexts/AuthContext.tsx`
  - `useBabyStatus` from `contexts/BabyStatusContext.tsx`
  - `expo-router`
- **Description**: Checks authentication status and redirects to the appropriate screen based on whether the user is logged in and whether the baby is born.

#### `app/+not-found.tsx`
- **Purpose**: 404 page for non-existent routes
- **Status**: Active
- **Dependencies**: `expo-router`
- **Description**: Displayed when a user navigates to a non-existent route.

### Authentication Files

#### `app/(auth)/_layout.tsx`
- **Purpose**: Layout for authentication screens
- **Status**: Active
- **Dependencies**: `expo-router`, `expo-status-bar`
- **Description**: Sets up the navigation stack for authentication screens.

#### `app/(auth)/index.tsx`
- **Purpose**: Entry point for authentication flow
- **Status**: Active
- **Dependencies**: `expo-router`
- **Description**: Redirects to the login screen.

#### `app/(auth)/login.tsx`
- **Purpose**: Login and registration screen
- **Status**: Active, core file
- **Dependencies**:
  - `useAuth` from `contexts/AuthContext.tsx`
  - `supabase` from `lib/supabase.ts`
- **Description**: Handles user login and registration with email/password. Contains a demo mode for testing.

#### `app/auth/callback.tsx`
- **Purpose**: Callback handler for email verification
- **Status**: Active
- **Dependencies**: `supabase` from `lib/supabase.ts`
- **Description**: Handles the callback after email verification.

### Tab Navigation Files

#### `app/(tabs)/_layout.tsx`
- **Purpose**: Tab navigation layout
- **Status**: Active, core file
- **Dependencies**:
  - `useBabyStatus` from `contexts/BabyStatusContext.tsx`
  - `HapticTab` from `components/HapticTab.tsx`
  - `IconSymbol` from `components/ui/IconSymbol.tsx`
  - `TabBarBackground` from `components/ui/TabBarBackground.tsx`
- **Description**: Sets up the bottom tab navigation with conditional tabs based on whether the baby is born.

#### `app/(tabs)/index.tsx` (Wehen-Tracker)
- **Purpose**: Main contraction tracking screen
- **Status**: Active, core feature
- **Dependencies**:
  - `VerticalContractionTimeline` from `components/VerticalContractionTimeline.tsx`
  - `saveContraction`, `getContractions`, `deleteContraction` from `lib/supabase.ts`
- **Description**: Allows users to track contractions with a timer, record intensity, and view a timeline of contractions.

#### `app/(tabs)/countdown.tsx`
- **Purpose**: Countdown to due date
- **Status**: Active, core feature for pregnancy phase
- **Dependencies**:
  - `CountdownTimer` from `components/CountdownTimer.tsx`
  - `useBabyStatus` from `contexts/BabyStatusContext.tsx`
- **Description**: Displays a countdown to the due date, pregnancy week information, and a button to mark the baby as born.

#### `app/(tabs)/explore.tsx` (Hospital Checklist)
- **Purpose**: Hospital bag checklist
- **Status**: Active
- **Dependencies**:
  - `ChecklistItem` from `components/ChecklistItem.tsx`
  - `ChecklistCategory` from `components/ChecklistCategory.tsx`
  - `AddChecklistItem` from `components/AddChecklistItem.tsx`
- **Description**: Allows users to manage a checklist of items to pack for the hospital.

#### `app/(tabs)/home.tsx`
- **Purpose**: Home screen for post-birth phase
- **Status**: Active, core feature for post-birth phase
- **Dependencies**:
  - `getBabyInfo`, `getDiaryEntries`, `getCurrentPhase` from `lib/baby.ts`
- **Description**: Displays a personalized dashboard with baby information, diary entries, and quick access cards.

#### `app/(tabs)/baby.tsx`
- **Purpose**: Baby information and development tracking
- **Status**: Active, core feature for post-birth phase
- **Dependencies**:
  - `getBabyInfo`, `saveBabyInfo` from `lib/baby.ts`
- **Description**: Displays baby information and development milestones.

#### `app/(tabs)/diary.tsx`
- **Purpose**: Baby diary overview
- **Status**: Active
- **Dependencies**:
  - `getDiaryEntries`, `saveDiaryEntry` from `lib/baby.ts`
- **Description**: Displays a list of diary entries and allows users to create new entries.

#### `app/(tabs)/geburtsplan.tsx` (Birth Plan)
- **Purpose**: Birth plan creation and management
- **Status**: Active
- **Dependencies**:
  - Components from `components/geburtsplan/`
  - `getGeburtsplan`, `saveStructuredGeburtsplan` from `lib/supabase.ts`
- **Description**: Allows users to create and manage a structured birth plan.

#### `app/(tabs)/more.tsx`
- **Purpose**: More menu with additional options
- **Status**: Active
- **Dependencies**:
  - `useAuth` from `contexts/AuthContext.tsx`
  - `useBabyStatus` from `contexts/BabyStatusContext.tsx`
- **Description**: Provides access to additional features and settings.

#### `app/(tabs)/daily_old.tsx`
- **Purpose**: Daily tracking for baby activities
- **Status**: Active but not in main navigation (accessible via quick access)
- **Dependencies**:
  - `getDailyEntries`, `saveDailyEntry` from `lib/baby.ts`
- **Description**: Allows tracking of daily activities like feeding, diaper changes, and sleep.

#### `app/(tabs)/selfcare.tsx`
- **Purpose**: Self-care tips and tracking for mothers
- **Status**: Active but not in main navigation (accessible via quick access)
- **Dependencies**: None specific
- **Description**: Provides self-care tips and allows mood tracking.

### Additional Screens

#### `app/diary-entries.tsx`
- **Purpose**: Detailed diary entries view
- **Status**: Active
- **Dependencies**:
  - `getDiaryEntries`, `saveDiaryEntry`, `deleteDiaryEntry` from `lib/baby.ts`
- **Description**: Displays detailed diary entries and allows editing.

#### `app/faq.tsx`
- **Purpose**: Frequently asked questions
- **Status**: Active
- **Dependencies**:
  - `getFaqCategories`, `getFaqEntries` from `lib/supabase/faq.ts`
- **Description**: Displays categorized FAQ entries.

#### `app/mini-wiki.tsx`
- **Purpose**: Knowledge base
- **Status**: Active
- **Dependencies**:
  - `getWikiCategories`, `getWikiEntries` from `lib/supabase/wiki.ts`
- **Description**: Displays categorized wiki articles.

#### `app/profil.tsx`
- **Purpose**: User and baby profile management
- **Status**: Active
- **Dependencies**:
  - `getBabyInfo`, `saveBabyInfo` from `lib/baby.ts`
  - `useAuth` from `contexts/AuthContext.tsx`
- **Description**: Allows users to manage their profile and baby information.

#### `app/termine.tsx` (Appointments)
- **Purpose**: Appointment management
- **Status**: Active
- **Dependencies**: None specific
- **Description**: Allows users to manage appointments.

### Context Providers

#### `contexts/AuthContext.tsx`
- **Purpose**: Authentication state management
- **Status**: Active, core file
- **Dependencies**:
  - `supabase`, `signInWithEmail`, `signUpWithEmail`, `signOut` from `lib/supabase.ts`
- **Description**: Manages authentication state and provides authentication functions.

#### `contexts/BabyStatusContext.tsx`
- **Purpose**: Baby birth status management
- **Status**: Active, core file
- **Dependencies**:
  - `getBabyBornStatus`, `setBabyBornStatus` from `lib/supabase.ts`
  - `useAuth` from `contexts/AuthContext.tsx`
- **Description**: Manages the status of whether the baby is born and provides functions to update this status.

### Components

#### UI Components

##### `components/ThemedText.tsx`
- **Purpose**: Text component with theme support
- **Status**: Active, widely used
- **Dependencies**: `useColorScheme` from `hooks/useColorScheme.ts`
- **Description**: A text component that adapts to the current theme.

##### `components/ThemedView.tsx`
- **Purpose**: View component with theme support
- **Status**: Active, widely used
- **Dependencies**: `useColorScheme` from `hooks/useColorScheme.ts`
- **Description**: A view component that adapts to the current theme.

##### `components/ui/IconSymbol.tsx` and `IconSymbol.ios.tsx`
- **Purpose**: Platform-specific icon component
- **Status**: Active, widely used
- **Dependencies**: `expo-symbols` for iOS
- **Description**: Provides a consistent icon interface across platforms.

##### `components/ui/TabBarBackground.tsx` and `TabBarBackground.ios.tsx`
- **Purpose**: Platform-specific tab bar background
- **Status**: Active
- **Dependencies**: `expo-blur` for iOS
- **Description**: Provides a platform-specific background for the tab bar.

#### Feature-specific Components

##### `components/VerticalContractionTimeline.tsx`
- **Purpose**: Vertical timeline for contractions
- **Status**: Active, core component
- **Dependencies**: `SwipeableContractionItem` from `components/SwipeableContractionItem.tsx`
- **Description**: Displays contractions in a vertical timeline with swipeable items.

##### `components/SwipeableContractionItem.tsx`
- **Purpose**: Swipeable item for contractions
- **Status**: Active
- **Dependencies**: `react-native-gesture-handler`
- **Description**: A swipeable list item for contractions with delete functionality.

##### `components/ContractionChart.tsx`
- **Purpose**: Chart for contractions
- **Status**: Active
- **Dependencies**: `react-native-svg`
- **Description**: Visualizes contractions with a chart.

##### `components/CountdownTimer.tsx`
- **Purpose**: Countdown timer for due date
- **Status**: Active
- **Dependencies**: `date-fns`
- **Description**: Displays a countdown to the due date with pregnancy week information.

##### `components/ChecklistItem.tsx`
- **Purpose**: Checklist item component
- **Status**: Active
- **Dependencies**: None specific
- **Description**: A component for displaying and interacting with checklist items.

##### `components/ChecklistCategory.tsx`
- **Purpose**: Checklist category component
- **Status**: Active
- **Dependencies**: None specific
- **Description**: A component for grouping checklist items by category.

##### `components/AddChecklistItem.tsx`
- **Purpose**: Component for adding checklist items
- **Status**: Active
- **Dependencies**: None specific
- **Description**: A form component for adding new checklist items.

##### `components/Collapsible.tsx`
- **Purpose**: Collapsible component
- **Status**: Active
- **Dependencies**: `react-native-reanimated`
- **Description**: A component that can be expanded and collapsed.

##### `components/HapticTab.tsx`
- **Purpose**: Tab button with haptic feedback
- **Status**: Active
- **Dependencies**: `expo-haptics`
- **Description**: A tab button that provides haptic feedback when pressed.

##### `components/ExternalLink.tsx`
- **Purpose**: External link component
- **Status**: Active
- **Dependencies**: `expo-web-browser`
- **Description**: A component for opening external links in the browser.

##### `components/HelloWave.tsx`
- **Purpose**: Animated wave component
- **Status**: Active
- **Dependencies**: `react-native-reanimated`
- **Description**: An animated wave component for visual appeal.

##### `components/ParallaxScrollView.tsx`
- **Purpose**: Scroll view with parallax effect
- **Status**: Active
- **Dependencies**: `react-native-reanimated`
- **Description**: A scroll view with a parallax effect for the background.

##### `components/AfterBirthView.tsx`
- **Purpose**: View for post-birth phase
- **Status**: Active
- **Dependencies**: None specific
- **Description**: A component for displaying post-birth information.

#### Geburtsplan (Birth Plan) Components

All components in the `components/geburtsplan/` directory are active and used in the birth plan feature. They include:

- `AllgemeineAngabenSection.tsx`: Personal information section
- `GeburtsWuenscheSection.tsx`: Birth preferences section
- `MedizinischeEingriffeSection.tsx`: Medical interventions section
- `NotfallSection.tsx`: Emergency section
- `NachDerGeburtSection.tsx`: Post-birth section
- `SonstigeWuenscheSection.tsx`: Additional wishes section
- `CheckboxOption.tsx`, `RadioOption.tsx`, `OptionGroup.tsx`: Form components
- `TextInputField.tsx`: Text input component
- `GeburtsplanSection.tsx`: Section wrapper component

### API and Data Files

#### `lib/supabase.ts`
- **Purpose**: Supabase client configuration and API functions
- **Status**: Active, core file
- **Dependencies**: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`
- **Description**: Sets up the Supabase client and provides functions for authentication and data operations.

#### `lib/baby.ts`
- **Purpose**: Baby-related data functions
- **Status**: Active, core file
- **Dependencies**: `supabase` from `lib/supabase.ts`
- **Description**: Provides functions for managing baby information, diary entries, daily entries, and development tracking.

#### `lib/supabase/geburtsplan.ts`
- **Purpose**: Birth plan data functions
- **Status**: Active
- **Dependencies**: `supabase` from `lib/supabase.ts`
- **Description**: Provides functions for managing birth plan data.

#### `lib/supabase/faq.ts`
- **Purpose**: FAQ data functions
- **Status**: Active
- **Dependencies**: `supabase` from `lib/supabase.ts`
- **Description**: Provides functions for retrieving FAQ data.

#### `lib/supabase/wiki.ts`
- **Purpose**: Wiki data functions
- **Status**: Active
- **Dependencies**: `supabase` from `lib/supabase.ts`
- **Description**: Provides functions for retrieving wiki data.

## Authentication System

The application uses Supabase for authentication with the following features:

### Authentication Methods
- Email/password authentication
- Demo mode login for testing

### Authentication Implementation Status

While the codebase contains functions for additional authentication methods in `lib/supabase.ts` (such as `signInWithApple`, `signInWithGoogle`, `signInWithMagicLink`), these are not actually implemented in the user interface. Only email/password authentication and the demo mode are accessible to users.

### Authentication Flow
1. Users can register with email/password
2. After registration, users are directed to complete their profile
3. Authentication state is managed through the `AuthContext` provider
4. Protected routes require authentication
5. A demo mode is available for testing without registration

### Implementation Details
- `AuthContext.tsx` manages the authentication state
- `supabase.ts` contains authentication API functions
- Session persistence is handled with AsyncStorage

## Database Schema

The application uses a PostgreSQL database through Supabase with the following main tables:

### User-related Tables
- `profiles`: User profile information
- `user_settings`: User preferences and settings including the `is_baby_born` flag

### Pregnancy-related Tables
- `contractions`: Contraction tracking data
- `hospital_checklist`: Hospital bag checklist items
- `geburtsplan`: Birth plan information

### Baby-related Tables
- `baby_info`: Basic baby information (name, birth date, etc.)
- `baby_diary`: Baby diary entries
- `baby_daily`: Daily tracking entries (feeding, diapers, etc.)
- `baby_development_phases`: Predefined baby development phases
- `baby_milestones`: Milestones within each development phase
- `baby_milestone_progress`: User progress on milestones
- `baby_current_phase`: Current development phase for the baby

### Content Tables
- `faq_categories`: Categories for FAQ entries
- `faq_entries`: Frequently asked questions and answers
- `selfcare_entries`: Self-care tips and activities

## Key Features

### Contraction Tracking
- Start/stop timer for contractions
- Record intensity (Weak, Medium, Strong)
- Visualize contractions with a timeline chart
- Calculate intervals between contractions
- Delete functionality with swipe gestures

### Hospital Checklist
- Predefined and custom checklist items
- Categories for organization
- Check/uncheck functionality
- Notes for each item
- Drag and drop reordering

### Birth Plan (Geburtsplan)
- Structured sections for different aspects of the birth plan
- Personal information section
- Birth preferences section
- Medical interventions preferences
- Emergency preferences
- Post-birth preferences
- Additional wishes section

### Countdown Page
- Days until due date calculation
- Current pregnancy week display
- Trimester information
- "Ich bin da!" (I'm here!) button to mark baby as born
- Links to relevant information

### Baby Diary
- Chronological entries with date and content
- Photo attachment capability
- Mood tracking
- Connection to development phases and milestones
- Collapsible entry display

### Daily Tracking
- Track feedings, diaper changes, and sleep
- Notes for each entry
- Time-based tracking
- Daily summary statistics

### Self-care for Mothers
- Personalized greetings
- Mood tracking
- Self-care tips
- Health tracking

### Mini-Wiki and FAQ
- Searchable knowledge base
- Categorized articles
- Frequently asked questions and answers

## Navigation Flow

The application has two main navigation phases controlled by the `is_baby_born` flag in Supabase:

### Phase 1: Pregnancy
Tabs:
- Home: Overview dashboard
- Countdown: Due date countdown and pregnancy information
- Checklist: Hospital bag checklist
- More: Additional features and settings

### Phase 2: Post-Birth
Tabs:
- My Baby: Baby information and development
- Diary: Baby diary entries
- Daily Life: Daily tracking and activities
- More: Additional features and settings

### Additional Screens
- Profile: User and baby profile management
- Termine (Appointments): Appointment management
- Mini-Wiki: Knowledge base
- FAQ: Frequently asked questions
- Geburtsplan (Birth Plan): Birth plan creation and management

## UI Components

The application uses a consistent design system with the following key components:

### Core Components
- `ThemedText`: Text component with theme support
- `ThemedView`: View component with theme support
- `IconSymbol`: Icon component using system icons
- `ExternalLink`: External link component
- `Collapsible`: Expandable/collapsible content component

### Feature-specific Components
- `ContractionChart`: Visualization for contractions
- `VerticalContractionTimeline`: Timeline view for contractions
- `SwipeableContractionItem`: Swipeable list item for contractions
- `CountdownTimer`: Timer for pregnancy countdown
- `ChecklistItem`: Checklist item component
- `ChecklistCategory`: Category component for checklist

### UI Design
- Soft, light beige color scheme
- Pastel colors for intensity indicators
- Subtle shadows and spacing for visual separation
- Background image (Background_Hell.png)

## State Management

The application uses React Context for global state management:

### Context Providers
- `AuthContext`: Manages authentication state
- `BabyStatusContext`: Manages the baby birth status

### Local State
- Component-level state using React's `useState` and `useEffect`
- Form state management for user inputs

## API Integration

The application integrates with Supabase for all backend functionality:

### Data Operations
- CRUD operations for all data entities
- Real-time updates for certain features
- File uploads for images

### API Structure
- API functions are organized by feature in the `lib` directory
- `supabase.ts`: Core Supabase client and authentication functions
- `baby.ts`: Baby-related data functions
- `supabase/geburtsplan.ts`: Birth plan functions
- `supabase/faq.ts`: FAQ-related functions
- `supabase/wiki.ts`: Wiki-related functions

## File Relationships and Dependencies

This section outlines the key relationships and dependencies between files in the application.

### Core Navigation Flow

1. `app/_layout.tsx` → Sets up the root navigation and context providers
2. `app/index.tsx` → Entry point that redirects based on auth status
3. `app/(auth)/_layout.tsx` or `app/(tabs)/_layout.tsx` → Depending on auth status

### Authentication Chain

1. `app/(auth)/login.tsx` → User interface for login/registration
2. `contexts/AuthContext.tsx` → Manages auth state
3. `lib/supabase.ts` → Handles API calls to Supabase auth

### Baby Status Chain

1. `app/(tabs)/countdown.tsx` → Contains "Ich bin da!" button to mark baby as born
2. `contexts/BabyStatusContext.tsx` → Manages baby born status
3. `lib/supabase.ts` → Updates status in database

### Contraction Tracking Chain

1. `app/(tabs)/index.tsx` → Main contraction tracking UI
2. `components/VerticalContractionTimeline.tsx` → Displays contractions
3. `components/SwipeableContractionItem.tsx` → Individual contraction items
4. `lib/supabase.ts` → Saves/retrieves contractions from database

### Diary Feature Chain

1. `app/(tabs)/diary.tsx` → Diary overview
2. `app/diary-entries.tsx` → Detailed diary entries
3. `lib/baby.ts` → Manages diary data

### Unused or Placeholder Files

The following directories appear to be placeholders for future implementation:

1. `app/(tabs-after-birth)/` → Empty directory, functionality implemented in `app/(tabs)/` with conditional rendering
2. `app/(tabs-before-birth)/` → Empty directory, functionality implemented in `app/(tabs)/` with conditional rendering

### File Dependency Graph

The application has a clear hierarchy of dependencies:

- **Top Level**: Layout and navigation files (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`)
- **Middle Level**: Context providers (`AuthContext.tsx`, `BabyStatusContext.tsx`)
- **Feature Level**: Screen components (`app/(tabs)/index.tsx`, `app/(tabs)/countdown.tsx`, etc.)
- **Component Level**: Reusable UI components (`components/ThemedText.tsx`, `components/VerticalContractionTimeline.tsx`, etc.)
- **API Level**: Data access functions (`lib/supabase.ts`, `lib/baby.ts`)

## Development and Deployment

### Development Environment
- Expo development server
- TypeScript for type checking
- ESLint for code linting

### Build and Deployment
- EAS (Expo Application Services) for building and updates
- EAS Update for over-the-air updates
- Master branch for deployment

### Scripts
- `npm start`: Start the Expo development server
- `npm run android`: Start the app on Android
- `npm run ios`: Start the app on iOS
- `npm run web`: Start the app in a web browser
- `npm test`: Run tests
- `npm run lint`: Run linting
- `npm run reset-project`: Reset the project

## Conclusion

The Wehen-Tracker app is a comprehensive solution for pregnancy and baby tracking, built with modern web technologies and a focus on user experience. The application's architecture allows for easy maintenance and extension, with clear separation of concerns and modular components.

The app is structured around two main phases (pregnancy and post-birth) with conditional rendering of tabs and features based on the baby's birth status. While some directories appear to be placeholders for future implementation, the core functionality is implemented in the main tab navigation with conditional rendering.

The authentication system currently only implements email/password authentication and a demo mode, despite having functions for additional methods in the codebase. This could be an area for future enhancement.
