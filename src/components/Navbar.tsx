import React from "react";
import {
  Calendar,
  Users,
  Bot,
  FileCheck,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  activeTab: "attendance" | "fridayReports" | "workers" | "whatsapp";
  setActiveTab: (tab: "attendance" | "fridayReports" | "workers" | "whatsapp") => void;
  currentTimeStr: string;
  isFriday: boolean;
  isFridayPost5PM: boolean;
  waConnected: boolean;
  driveConnected: boolean;
  onOpenLocationSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTimeStr,
  isFriday,
  isFridayPost5PM,
  waConnected,
  driveConnected,
  onOpenLocationSettings,
}) => {
  const { user, profile, loginWithGoogle, logout, loading } = useAuth();
  const [loggingIn, setLoggingIn] = React.useState(false);

  const handleGoogleAuth = async () => {
    try {
      setLoggingIn(true);
      const res = await loginWithGoogle();
      if (res.cancelled) {
        // User closed the popup window - smooth cancel
        return;
      }
      if (res.error) {
        console.warn("Login notice:", res.error);
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        console.error("Firebase Google login error:", err);
      }
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-slate-300/30 shrink-0 overflow-hidden">
              <img
                src="https://i.ibb.co.com/0jwQZRH0/Logo-Nusantara-Mineral-Sukses-Abadi.jpg"
                alt="Logo PT. Nusantara Mineral Sukses Abadi"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight">PT. NMSA</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  Presensi Karyawan
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Nusantara Mineral Sukses Abadi • Terintegrasi Asisten WhatsApp AI
              </p>
            </div>
          </div>

          {/* Time & Friday Status Banner */}
          <div className="hidden md:flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200 font-medium">{currentTimeStr}</span>
            {isFriday ? (
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  isFridayPost5PM
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {isFridayPost5PM ? "Jumat ≥ 17:00 (Auto-Arsip Drive Aktif)" : "Jumat (Hari Rekap Mingguan)"}
              </span>
            ) : null}
          </div>

          {/* Quick Badges & User Identity Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenLocationSettings}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors"
              title="Pengaturan Radius & Lokasi Kantor"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Lokasi Kantor</span>
            </button>

            {/* WA Indicator */}
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
                waConnected
                  ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WA AI Bot</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  waConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
            </button>

            {/* Firebase User Authentication & Identity */}
            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <div className="flex items-center space-x-2 bg-slate-800/90 py-1 px-2.5 rounded-xl border border-slate-700">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-6 h-6 rounded-full border border-emerald-400/50 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <p className="text-[11px] font-semibold text-slate-200 truncate max-w-[120px] leading-tight">
                      {user.displayName || user.email?.split("@")[0]}
                    </p>
                    <span className="text-[9px] text-emerald-400 font-medium leading-none block">
                      {profile?.role === "admin" ? "Admin NMSA" : "Tim NMSA"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                  title="Keluar / Logout Akun"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loggingIn || loading}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span className="hidden sm:inline">{loggingIn ? "Memuat..." : "Masuk Google"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 sm:space-x-4 border-t border-slate-800 pt-2 pb-2 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "attendance"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Presensi Mingguan</span>
          </button>

          <button
            onClick={() => setActiveTab("fridayReports")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "fridayReports"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Riwayat Laporan Absen</span>
            {isFriday && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          </button>

          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "whatsapp"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Asisten WhatsApp AI</span>
          </button>

          <button
            onClick={() => setActiveTab("workers")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "workers"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data Karyawan (9)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
