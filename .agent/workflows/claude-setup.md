---
description: how to set up the environment for Claude Code
---

The following steps will prepare the environment for Claude Code or other development agents.

// turbo
1. Install all dependencies for the project, including backend and frontend subfolders:
   ```bash
   npm run install-all
   ```

2. Generate a secure `JWT_SECRET` in `backend/.env` (if it doesn't exist):
   ```bash
   if [ ! -f backend/.env ]; then
     echo "JWT_SECRET=$(openssl rand -base64 32)" > backend/.env
     echo "SQLITE_DB_PATH=./aquamen.sqlite" >> backend/.env
   fi
   ```

3. Ensure the database is migrated and seeded:
   ```bash
   cd backend && npm run migrate && npm run seed
   ```

4. Verify set up by running the development server:
   ```bash
   npm run dev
   ```
