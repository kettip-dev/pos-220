import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const GOOGLE_AUTH_APP_NAME = "superadmin-google-auth";

export function getGoogleAuthClient(firebaseConfig) {
  const app = getApps().some((item) => item.name === GOOGLE_AUTH_APP_NAME)
    ? getApp(GOOGLE_AUTH_APP_NAME)
    : initializeApp(firebaseConfig, GOOGLE_AUTH_APP_NAME);

  return {
    auth: getAuth(app),
    googleProvider: new GoogleAuthProvider(),
  };
}
