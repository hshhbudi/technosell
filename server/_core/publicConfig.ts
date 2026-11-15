// Only these public values may reach the browser. Never serialize process.env.
function firebaseApiKey(env: NodeJS.ProcessEnv) {
  const configured = env.VITE_FIREBASE_API_KEY ?? "";
  // Accept both a raw Web API key and a pasted Firebase config snippet.
  return configured.match(/apiKey\s*:\s*["']([^"']+)["']/)?.[1] ?? configured.trim();
}

export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? "",
    firebaseConfig: {
      apiKey: firebaseApiKey(env),
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
      projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: env.VITE_FIREBASE_APP_ID ?? "",
    },
  };
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
