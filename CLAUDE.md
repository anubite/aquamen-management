# Aquamen Management - Claude Code Guide

## Project Overview
Aquamen Management is a specialized administration tool for swimming team management.

- **Stack**: Node.js (Express) + React (Vite) + SQLite (Knex.js).
- **Structure**:
  - `backend/`: Express server, migrations, seeds, CLI tools.
  - `frontend/`: React application with Tailwind CSS.

## Development Commands

### Environment Setup
- **Install All Dependencies**: `npm run install-all` (ROOT)
- **Database Setup**: (Already handled by `npm run install-all` or manually via `cd backend && npm run migrate && npm run seed`)

### Starting Services
- **Full Application (Backend + Frontend)**: `npm run dev` (ROOT)
- **Backend Only**: `cd backend && npm run dev`
- **Frontend Only**: `cd frontend && npm run dev`
- **One-click Launch (kills existing ports)**: `./launch.sh` (ROOT)

### Build and Deployment
- **Full Build**: `npm run build` (ROOT)
- **Production Start**: `npm start` (ROOT - starts backend which serves frontend or API)

### Management Tools
- **User Management**: `npm run users -- [CMD]` (ROOT) or `node manage-users.js [CMD]` (BACKEND)
  - `list`
  - `create username password`
  - `changepassword username newpass`
  - `delete username`
- **Member Management**: Similar to users but for members: `npm run members -- [CMD]`

## Code Style & Guidelines
- **Language**: JavaScript (CommonJS in backend, ESM in frontend).
- **Frontend**: Functional React components with Tailwind CSS.
- **Backend**: Express.js with Knex.js for migrations.
- **Naming**: camelCase for variables/functions, PascalCase for React components.
- **Error Handling**: Use `try/catch` in async routes/functions; consistent response format.
- **Database**: All schema changes MUST go through Knex migrations in `backend/migrations/`.
