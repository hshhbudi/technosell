// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID ?? ""; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // The owner email is supplied through the protected project secret card.
  get ownerEmail() { return (process.env.STORE_OWNER_EMAIL ?? "").trim().toLowerCase(); },
  // Preserve the legacy hint when supplied.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  get fast4topApiToken() { return process.env.FAST4TOP_API_TOKEN ?? ""; },
  get fast4topApiKey() { return process.env.FAST4TOP_API_KEY ?? ""; },
  get localAdminEmail() { return (process.env.TECHNOSELL_ADMIN_EMAIL ?? "").trim().toLowerCase(); },
  get localAdminPassword() { return process.env.TECHNOSELL_ADMIN_PASSWORD ?? ""; },
  get firebaseProjectId() { return process.env.FIREBASE_PROJECT_ID ?? ""; },
  get firebaseClientEmail() { return process.env.FIREBASE_CLIENT_EMAIL ?? ""; },
  get firebasePrivateKey() { return process.env.FIREBASE_PRIVATE_KEY ?? ""; },
};
