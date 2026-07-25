// Hexclave project config — CITED (c0mpiled SuS hackathon).
// Auth + payments are enabled/configured through the dashboard onboarding;
// deployments-alpha hosts the app on Vercel via the Hexclave CLI.
export const config = {
  apps: {
    installed: {
      authentication: { enabled: true },
      "deployments-alpha": { enabled: true },
    },
  },
  "deployments-alpha": {
    services: {
      web: {
        type: "vercel",
        rootDirectory: "./",
        framework: "nextjs",
        installCommand: "npm install",
        buildCommand: "npm run build",
        outputDirectory: ".next",
        env: {
          NEXT_PUBLIC_HEXCLAVE_PROJECT_ID: { type: "connection", value: "hexclave.projectId" },
        },
      },
    },
  },
};
