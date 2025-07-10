# XML Question Editor

## Overview

The XML Question Editor is a professional web application designed for educational content reviewers to manually validate, edit, and manage XML math questions for educational games. The system provides a comprehensive interface for handling XML-formatted educational content with features for file management, question editing, validation, and export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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