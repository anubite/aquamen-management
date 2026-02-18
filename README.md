# Aquamen Management

Aquamen Management is a specialized administration tool designed for swimming team management. It provides a robust and intuitive interface for administrators to manage member records, training groups, and membership statuses.

## Features

-   **Member Administration**: Complete CRUD (Create, Read, Update, Delete) operations for team members.
-   **Group Classification**: Assign and track members in different training groups (e.g., Groups A, B, and C).
-   **Status Monitoring**: Track membership status (Active vs. Canceled) with visual indicators.
-   **Real-time Search**: Instant filtering of members by name, surname, or email.
-   **Secure Access**: Protected dashboard with JWT-based authentication.
-   **Modern Tech Stack**: Built with React (Vite) on the frontend and Node.js (Express) with SQLite on the backend.

## Prerequisites

Before setting up the project, ensure you have the following installed:

-   **Node.js** (v18 or higher recommended)
-   **npm** (comes with Node.js)
-   **Homebrew** (for macOS users, recommended for installing Node.js)

## Setup and Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/anubite/aquamen-management.git
    cd aquamen-management
    ```

2.  **Install All Dependencies**:
    Run the following command in the root directory to install dependencies for the root, backend, and frontend:
    ```bash
    npm run install-all
    ```

3.  **Environment Configuration**:
    The application uses a default SQLite database and pre-configured JWT secrets. You can customize these in the `.env` file in the `backend` directory if needed.

## Running the Application

To start the both the backend and frontend development servers concurrently, run:

```bash
npm run dev
```

### Simplified Launch (Local Only)

For a cleaner local experience, you can use a launch script that automatically kills existing processes on ports 5000 and 5173 before starting.

1.  Copy the example script:
    ```bash
    cp launch.sh.example launch.sh
    chmod +x launch.sh
    ```
2.  Run the script directly:
    ```bash
    ./launch.sh
    ```

> [!NOTE]
> `launch.sh` is ignored by git and is intended for local use only.

-   **Frontend**: http://localhost:5173
-   **Backend API**: http://localhost:5000

## Project Structure

-   `backend/`: Express server, SQLite database logic, and API routes.
-   `frontend/`: React application built with Vite and Tailwind CSS.
-   `package.json`: Root configuration for managing the full-stack workspace.
## Deployment

The project is pre-configured for deployment to **Render.com**.

### Quick Deploy (Render Blueprint)

1.  Push your code to a GitHub repository.
2.  Connect the repository to Render.com.
3.  Render will automatically detect the `render.yaml` Blueprint.
4.  Accept the Blueprint configuration to create the web service and a persistent disk for the database.

### Manual Configuration Notes

-   **Environment Variables**:
    -   `JWT_SECRET`: Needs to be a secure random string (Render auto-generates this if using the Blueprint).
    -   `SQLITE_DB_PATH`: Points to the database file location. For persistence, this should be on a mounted disk (e.g., `/var/lib/sqlite/aquamen.sqlite`).
-   **Persistent Disk**: SQLite databases are stored in a single file. Ensure you mount a persistent disk to your service to prevent data loss whenever the service restarts or redeploys.
-   **Build Command**: `npm run build`
-   **Start Command**: `npm start`
