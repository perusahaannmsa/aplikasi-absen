import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { setupApiInterceptor } from "./lib/api-interceptor";
import "./index.css";

// Setup API interceptor for Firebase Hosting support
setupApiInterceptor();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

