import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Google Auth Provider with Drive Scope
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Test Firestore Connection on boot per Skill Guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline or rules not allowing test doc.");
    }
    return false;
  }
}

export interface SignInResult {
  user: User | null;
  accessToken?: string;
  cancelled?: boolean;
  error?: string;
}

// Helper to sign in with Google Popup
export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    // Persist user profile in Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "User",
          photoURL: user.photoURL || "",
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Could not write user to Firestore:", e);
    }

    // If we got a Google OAuth token, sync it to server for Google Drive operations
    if (accessToken) {
      try {
        await fetch("/api/drive/sync-firebase-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            userEmail: user.email,
            displayName: user.displayName,
          }),
        });
      } catch (err) {
        console.error("Failed to sync Drive token with backend:", err);
      }
    }

    return { user, accessToken };
  } catch (error: any) {
    const code = error?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      // User closed the popup window before completing sign-in
      return { user: null, cancelled: true };
    }
    if (code === "auth/popup-blocked") {
      return {
        user: null,
        error: "Jendela pop-up login diblokir oleh browser. Silakan izinkan pop-up atau buka aplikasi di tab baru.",
      };
    }
    console.warn("Firebase Auth notice:", error?.message || error);
    return {
      user: null,
      error: error?.message || "Terjadi kendala saat autentikasi dengan Google.",
    };
  }
}

// Sign out helper
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  try {
    await fetch("/api/drive/disconnect", { method: "POST" });
  } catch (e) {
    console.error("Failed to notify backend on disconnect:", e);
  }
}

// Listener for auth state changes
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Execute connection test on import
testFirestoreConnection().catch((err) => {
  console.debug("Firestore test connection completed with notice:", err?.message);
});
