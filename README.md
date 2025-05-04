# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5a0352e7-70c0-4069-8506-97ddfb22d005

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5a0352e7-70c0-4069-8506-97ddfb22d005) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Node.js (for API routes)
- FFmpeg (via `@ffmpeg-installer/ffmpeg` and `fluent-ffmpeg`)
- AWS S3 (via `@aws-sdk/client-s3`)
- OpenAI API (via `openai`)
- NocoDB (via `axios`)
- Wavesurfer.js

## How can I deploy this project?

This project is configured for deployment on [Vercel](https://vercel.com/).

### Vercel Deployment:

1.  **Connect Repository:** Connect your Git repository (GitHub, GitLab, Bitbucket) to Vercel.
2.  **Framework Preset:** Vercel should automatically detect Vite.
3.  **Build Command:** Ensure Vercel uses `vite build` or `bun run build`.
4.  **Output Directory:** Ensure Vercel uses `dist`.
5.  **Install Command:** Ensure Vercel uses `bun install` or `npm install`.
6.  **Environment Variables:** Configure the following environment variables in your Vercel project settings:
    *   `AWS_ACCESS_KEY_ID`: Your AWS access key ID.
    *   `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
    *   `AWS_REGION`: The AWS region for your S3 bucket (e.g., `us-east-1`).
    *   `S3_BUCKET_NAME`: The name of your AWS S3 bucket.
    *   `OPENAI_API_KEY`: Your OpenAI API key (required for transcription and AI music selection).
    *   `PROCESS_API_KEY`: A secret key you define for authenticating direct API calls (not from the UI).
    *   `NOCODB_API_URL`: The base URL for your NocoDB API (e.g., `https://your-nocodb.example.com/api/v1/db/data/v1/`).
    *   `NOCODB_AUTH_TOKEN`: Your NocoDB authentication token (`xc-token`).
    *   `VITE_SLICR_API_KEY`: A **public** key used by the frontend UI to identify itself (can be the same as `PROCESS_API_KEY` or different, but must be prefixed with `VITE_`). The backend ignores this key if the request comes from an allowed UI origin.

Simply open [Lovable](https://lovable.dev/projects/5a0352e7-70c0-4069-8506-97ddfb22d005) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
