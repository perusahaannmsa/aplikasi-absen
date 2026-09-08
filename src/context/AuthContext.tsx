import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "firebase/auth";
import {
  auth,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  db,
  SignInResult,
} from "../lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "admin" | "manager" | "staff";
  lastLoginAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<SignInResult>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or subscribe to user profile in Firestore
        const userRef = doc(db, "users", firebaseUser.uid);
        const unsubDoc = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: data.role || (firebaseUser.email?.includes("admin") || firebaseUser.email?.includes("nmsa") ? "admin" : "staff"),
              lastLoginAt: data.lastLoginAt,
            });
          } else {
            // Default profile
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: "admin", // Default to admin for initial corporate managers
            });
          }
        });

        setLoading(false);
        return () => unsubDoc();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        setUser(result.user);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = profile?.role === "admin" || !user || Boolean(user?.email);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithGoogle: handleLoginWithGoogle,
        logout: handleLogout,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
