// Increase max listeners to prevent warnings during HMR
// This file is automatically loaded by Next.js on startup
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Increase listener limit for development HMR
    process.setMaxListeners(20);
  }
}
