import * as admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const serviceAccountPath = join(
  process.cwd(),
  "pos-system-2bd48-firebase-adminsdk-fbsvc-8994f855ec.json"
);

let credential: admin.credential.Credential;
let projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (existsSync(serviceAccountPath)) {
  const parsed = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
  credential = admin.credential.cert(parsed as admin.ServiceAccount);
  if (!projectId) {
    projectId = parsed?.projectId || parsed?.project_id;
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = admin.credential.cert(parsed as admin.ServiceAccount);
  if (!projectId) {
    projectId = parsed?.projectId || parsed?.project_id;
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = admin.credential.applicationDefault();
} else {
  throw new Error(
    "Firebase admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

if (!projectId) {
  throw new Error(
    "Firebase project ID is not configured. Set FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID, or include project_id in the service account."
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    projectId,
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
