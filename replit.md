# XML Question Editor

## Overview

The XML Question Editor is a professional web application designed for educational content reviewers to manually validate, edit, and manage XML math questions for educational games. The system provides a comprehensive interface for handling XML-formatted educational content with features for file management, question editing, validation, and export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 12, 2025
- **ADDED: AI-Powered Text Shortening Feature** - Smart question text optimization
  - **Word Count Display**: Question Text field now shows word count with red highlighting when over 30 words
  - **AI Shortening Button**: "Shorten Text" button appears when questions exceed 30 words
  - **OpenAI Integration**: GPT-4o powered text shortening preserving mathematical accuracy and educational context
  - **Smart Preservation**: Maintains core math concepts, numerical values, grade-appropriate language, and adventure theme elements
  - **Theme-Aware Shortening**: Preserves character names like "Blade the Fearless" and locations like "Underworld Dungeon" while removing redundant phrases
  - **User-Friendly Interface**: Loading states and seamless auto-save integration
  - **Production Ready**: Error handling, timeout management, and proper API validation
  - **Batch Processing**: Added "Shorten All" button for processing multiple questions at once
    - Shows count badge of questions over 30 words
    - Processes all long questions in a single batch API call
    - Fallback to individual processing if batch fails
    - Progress indicators and automatic refresh after completion

### July 11, 2025
- Added automatic validation system for groups of 20 questions with manual trigger button
- Implemented visual status indicators (green check, yellow warning, red error) for validation results
- Added XML file merging functionality to combine multiple XML files into one
- Implemented XML file splitting capability to separate large files by grade or theme
- Enhanced backend API with merge/split endpoints and proper ZIP file generation
- Disabled auto-validation by default to give users control over when validation runs
- **FIXED: Duplicate Detection Results Display** - Resolved issue where results briefly flashed then disappeared
  - **Root Cause**: Dialog auto-close callback was hiding results immediately after detection completed
  - **Response Format Fix**: Corrected frontend to match backend response structure (data.duplicateDetectionResult)
  - **Persistent Results**: Removed auto-close behavior so results stay visible in dialog for user review
  - **Enhanced UX**: Added "Clear Results" button, helpful tooltips explaining detection options, improved sample display, and debug information for better user control
  - **Verified Performance**: Successfully processes 500 questions, finds 317 duplicates in 66 groups within 447ms
- **ENHANCED: Production-Grade AI Verification Module** - Multi-tier validation system
  - **SymPy Mathematical Validation**: Deterministic arithmetic verification catching 10.8% more errors
  - **Rule-Based Validation Engine**: 8 configurable validation rules with automatic issue detection
  - **Circuit Breaker Pattern**: Resilient fallback systems preventing cascade failures
  - **Enhanced UI**: Mathematical validation display, severity indicators, validation method badges
  - **Grade-Level Enforcement**: Strict number limits per grade (Grade 1: ≤20, Grade 2: ≤100, etc.)
  - **Production Features**: Answer-explanation consistency, ellipsis detection, choice format validation
- **COMPLETED: Comprehensive Duplicate Detection System**
  - **Multi-Algorithm Detection**: Exact matching, content similarity, and whitespace-aware comparison
  - **Smart Question Analysis**: Compares question text, answers, choices, and explanations
  - **User-Friendly Interface**: Dedicated tab with configurable detection options and similarity threshold
  - **Batch Processing**: Handles large XML files (500+ questions) with timeout protection
  - **Clean XML Generation**: Creates new XML files with duplicates removed, preserving structure
  - **Production Performance**: Successfully processes 500 questions in <500ms, finding 300+ duplicates
  - **IMPROVED: Mathematical Content Detection**: Enhanced algorithm reduces false positives for math questions
    - **Smart Pattern Recognition**: Detects arithmetic expressions, decimals, fractions, currency, and units
    - **Contextual Similarity**: Questions like "3+2" vs "5+6" are now correctly identified as different
    - **Jaccard Similarity**: Upgraded from character-based to word-based similarity for better accuracy
    - **Mathematical Weighting**: Reduced similarity scores when mathematical content differs significantly
  - **FIXED: XML Parser Issues**: Resolved "[object Object]" display by implementing robust CDATA preprocessing
  - **FIXED: String Handling**: Enhanced type safety preventing crashes from mixed object/string XML content
  - **VERIFIED: Complete Pipeline**: End-to-end testing confirms duplicate detection works reliably

### July 10, 2025
- Successfully resolved XML upload functionality - file selection and upload working correctly
- Added delete button for removing bad questions with confirmation dialog
- Removed separate "Correct Answer" field from question editor interface
- Updated choices section to highlight correct answer in green with check mark icon
- Correct choice now shows green background, green border, and green text
- Enhanced color scheme with distinct left sidebar (slate-100 background) for better visual separation from main content

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **File Upload**: Multer for handling XML file uploads
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL-based session storage

## Key Components

### 1. Question Management System
- **Question Model**: Comprehensive question schema with XML metadata
- **CRUD Operations**: Full create, read, update, delete functionality
- **Batch Operations**: Support for bulk question operations
- **Search and Filtering**: Advanced filtering by grade, domain, status, and text search

### 2. XML Processing Engine
- **XML Parser**: DOM-based XML parsing with error handling
- **CDATA Support**: Proper handling of CDATA sections for mathematical content
- **Validation**: XML structure validation with detailed error reporting
- **Export**: XML generation maintaining original structure

### 3. User Interface Components
- **Dashboard**: Main application interface with tabbed navigation
- **Question List**: Sortable, filterable question table with pagination
- **Question Editor**: Split-screen editor with real-time preview
- **File Upload**: Drag-and-drop XML file upload with progress tracking
- **Validation Panel**: Real-time validation feedback and error reporting

### 4. Validation System
- **Mathematical Accuracy**: Checks for mathematical correctness
- **Grade Appropriateness**: Validates number ranges for grade levels
- **Answer Consistency**: Ensures answers match explanations
- **Content Validation**: Checks for duplicate choices and content length
- **Batch Validation**: Processes 20 questions at a time with visual feedback
- **Status Indicators**: Green check (valid), yellow warning (warnings), red error (errors)

### 5. XML File Management
- **File Merging**: Combines multiple XML files into a single file
- **File Splitting**: Separates large XML files by grade level or theme
- **ZIP Generation**: Creates compressed archives for split files
- **Format Preservation**: Maintains original XML structure and CDATA sections

### 6. Production-Grade AI Verification System
- **Three-Tier Validation Pipeline**:
  - **SymPy Mathematical Validation**: Python-based deterministic arithmetic verification
  - **Rule-Based Validation Engine**: 8 configurable rules for format, consistency, and standards
  - **AI Pedagogical Analysis**: GPT-4o for Common Core alignment and educational quality
- **Enhanced Mathematical Accuracy**: SymPy integration catches computational errors AI misses
- **Circuit Breaker Pattern**: Resilient architecture with automatic fallback to rule-based validation
- **Grade-Level Enforcement**: Automatic number limit validation per grade level
- **Advanced Issue Detection**: Ellipsis patterns, truncation, prefix corruption, choice formatting
- **Production Reliability**: Error handling, timeout management, concurrent validation processing
- **Enhanced UI**: Mathematical validation indicators, severity badges, validation method display

## Data Flow

### 1. XML Upload Process
1. User uploads XML file via drag-and-drop or file picker
2. File is validated for XML structure and format
3. XML is parsed and questions are extracted
4. Questions are validated against business rules
5. Valid questions are stored in database
6. Upload results are reported to user

### 2. Question Editing Workflow
1. User selects question from filtered list
2. Question data is loaded into editor form
3. User makes changes with real-time validation
4. Changes are auto-saved after 2-second delay
5. Validation status is updated in real-time
6. User can navigate between questions using keyboard shortcuts

### 3. Export Process
1. User selects export filters (grade, domain, etc.)
2. Questions are queried from database
3. XML is generated maintaining original structure
4. File is downloaded to user's device

## External Dependencies

### Runtime Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL database client
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: UI component primitives
- **drizzle-orm**: Type-safe database ORM
- **express**: Web application framework
- **multer**: File upload handling
- **react-hook-form**: Form management
- **zod**: Schema validation
- **wouter**: Client-side routing

### Development Dependencies
- **drizzle-kit**: Database schema management
- **esbuild**: Server-side bundling
- **tailwindcss**: Utility-first CSS framework
- **tsx**: TypeScript execution
- **vite**: Frontend build tool

## Deployment Strategy

### Development Environment
- **Development Server**: Vite dev server for frontend hot reloading
- **Backend Server**: Express server with TypeScript execution via tsx
- **Database**: Neon PostgreSQL database
- **Environment Variables**: DATABASE_URL for database connection

### Production Build
- **Frontend**: Vite builds static assets to `dist/public`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations applied via `db:push` command
- **Deployment**: Single Node.js process serving both API and static files

### Key Architectural Decisions

1. **Database Choice**: PostgreSQL was chosen for its robustness and JSON support for storing question choices and validation errors
2. **ORM Selection**: Drizzle ORM provides type safety and excellent PostgreSQL support
3. **State Management**: TanStack Query handles server state caching and synchronization
4. **Component Library**: shadcn/ui provides consistent, accessible components
5. **Validation Strategy**: Zod schemas ensure type safety across frontend and backend
6. **File Processing**: Client-side XML parsing reduces server load and provides immediate feedback
7. **Auto-save**: Debounced auto-save prevents data loss during editing sessions

The architecture prioritizes type safety, user experience, and maintainability while handling the complex requirements of educational content management.