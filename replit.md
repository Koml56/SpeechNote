# ChefAudio - Recipe Audio & Text Note Manager

## Overview

ChefAudio is a full-stack web application designed for managing recipes with integrated audio recordings and text notes. Built with a modern React frontend and Express.js backend, it provides an intuitive interface for creating, organizing, and playing back culinary notes and instructions.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with Shadcn/UI styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations
- **API Design**: RESTful endpoints with JSON responses

### Development Environment
- **Platform**: Replit with Node.js 20, Web, and PostgreSQL 16 modules
- **Development Server**: Concurrent frontend (Vite) and backend (Express) on port 5000
- **Hot Reload**: Vite HMR for frontend, tsx for backend TypeScript execution

## Key Components

### Database Schema
The application uses three main tables:
- **recipes**: Stores recipe names and metadata
- **audio_recordings**: Stores base64-encoded audio data with metadata (duration, MIME type)
- **text_notes**: Stores textual notes associated with recipes

### Audio Recording System
- **Browser API**: Web Audio API for microphone access and recording
- **Storage Format**: Base64-encoded audio blobs stored in PostgreSQL
- **Playback**: HTML5 Audio API with custom controls
- **Permissions**: Graceful handling of microphone permissions

### API Endpoints
- `GET /api/recipes` - Fetch all recipes
- `GET /api/recipes/:id` - Fetch recipe with all associated content
- `POST /api/recipes` - Create new recipe
- `DELETE /api/recipes/:id` - Delete recipe and associated content
- Audio and text note CRUD operations (endpoints defined in routes but implementation pending)

### UI Components
- **Recipe Management**: Create, select, and delete recipes
- **Audio Recording**: Real-time recording with duration display
- **Audio Playback**: Custom audio player with play/pause controls
- **Text Notes**: Rich text input for recipe notes
- **Responsive Design**: Mobile-optimized interface with toast notifications

## Data Flow

1. **Recipe Creation**: User creates recipe → Frontend validates → API stores in database
2. **Audio Recording**: User grants mic permission → Records audio → Converts to base64 → Stores with metadata
3. **Content Retrieval**: Frontend requests recipe → Backend joins tables → Returns complete recipe data
4. **Audio Playback**: User clicks play → Frontend converts base64 to blob → Creates object URL → Plays audio

## External Dependencies

### Frontend Dependencies
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Accessible UI component primitives
- **react-hook-form**: Form state management
- **zod**: Runtime type validation
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing library

### Backend Dependencies
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **express**: Web application framework
- **zod**: Schema validation for API endpoints

### Development Dependencies
- **vite**: Fast build tool and development server
- **tsx**: TypeScript execution engine for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Production Build
- **Frontend**: Vite builds optimized static assets to `dist/public`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations ensure schema consistency

### Replit Deployment
- **Target**: Autoscale deployment on Replit infrastructure
- **Port Configuration**: External port 80 maps to internal port 5000
- **Environment**: Production environment variables for database connection
- **Static Assets**: Express serves built frontend from `dist/public`

### Database Configuration
- **Development**: Uses DATABASE_URL environment variable
- **Schema**: Shared TypeScript schema ensures type safety across frontend/backend
- **Migrations**: Drizzle generates and applies database migrations

## Changelog
- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.