# Project-File-Uploader

This is a simple web application that allows users to upload and organize files into folders. It provides user authentication, folder creation, file uploading (with Cloudinary integration), and basic file management.

## Features

- **User Authentication:** Secure registration and login for users.
- **Folder Management:** Users can create, edit, and delete their own folders.
- **File Uploading:** Users can upload files directly or into specific folders using Cloudinary for storage.
- **Dashboard:** A central view showing the user's folders and files uploaded without a specific folder.
- **File Details:** Users can view details about their uploaded files.

## Technologies Used

- **Node.js:** JavaScript runtime environment.
- **Express:** Web application framework for Node.js.
- **Prisma:** Next-generation ORM for Node.js and TypeScript.
- **PostgreSQL:** Relational database.
- **express-session:** Middleware for handling user sessions.
- **@quixo3/prisma-session-store:** Session store for Express using Prisma.
- **passport:** Authentication middleware for Node.js.
- **passport-local:** Strategy for username and password authentication.
- **bcrypt:** Library for password hashing.
- **multer:** Middleware for handling file uploads.
- **Cloudinary:** Cloud-based image and video management service.
- **dotenv:** For managing environment variables.

## Setup Instructions

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd <repository_name>
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    - Create a `.env` file in the root directory.
    - Add the following environment variables, replacing the placeholders with your actual values:
      ```env
      DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?schema=public"
      SESSION_SECRET="your-secure-secret"
      CLOUDINARY_CLOUD_NAME="your_cloud_name"
      CLOUDINARY_API_KEY="your_api_key"
      CLOUDINARY_API_SECRET="your_api_secret"
      PORT=3000 # Optional: Change the default port
      NODE_ENV=development # or production
      ```

4.  **Set up Prisma:**

    ```bash
    npx prisma migrate dev --name init
    npx prisma generate
    ```

    This will create the database schema and generate the Prisma Client.

5.  **Run the application:**

    ```bash
    npm start
    ```

    The application will be accessible at `http://localhost:3000` (or the port you specified in `.env`).

## Usage

1.  **Register:** Navigate to `/register` to create a new user account.
2.  **Login:** Navigate to `/login` to log in with your credentials.
3.  **Dashboard:** After logging in, you will be redirected to the `/dashboard` where you can see your folders and files uploaded without a specific folder.
4.  **Create Folder:** Click on "Crear Nueva Carpeta" to create a new folder.
5.  **Upload File:**
    - On the dashboard, click "Subir Archivo (sin carpeta)" to upload a file directly. It will be stored in a designated "Loose Files" section.
    - Within a specific folder (click on the folder name), you can upload files directly into that folder.
6.  **Manage Folders:** On the dashboard or the `/folders` page, you can edit or delete your folders.
7.  **View Files:** Click on a folder name to see the files within it. Click on a file name to view its details and a link to download/view it.
8.  **Logout:** Click on "Cerrar Sesión" to log out of your account.

## Important Notes

- Ensure your PostgreSQL database is running and accessible.
- Make sure your Cloudinary account is set up and you have provided the correct API keys and secret in the `.env` file.
- This is a basic implementation and can be further enhanced with more features and better error handling.
