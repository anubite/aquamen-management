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

-   **Frontend**: http://localhost:5173
-   **Backend API**: http://localhost:5000

## Authentication

Access to the management dashboard is protected. Use the following default credentials to log in:

-   **Username**: `aquamen`
-   **Password**: `milujemeAI`

## Project Structure

-   `backend/`: Express server, SQLite database logic, and API routes.
-   `frontend/`: React application built with Vite and Tailwind CSS.
-   `package.json`: Root configuration for managing the full-stack workspace.
