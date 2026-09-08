import React, { useState, useEffect } from "react";
import {
  FileCheck,
  FolderTree,
  CloudUpload,
  FileDown,
  ExternalLink,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Send,
  Trash2,
  Key,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
  HardDrive,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Info,
  ArrowRight,
} from "lucide-react";
import { WeeklyReport, Worker } from "../types";
import { downloadWeeklyReportPDF } from "../lib/attendanceSheetGeneratorPDF";
import { signInWithGoogle } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

interface FridayReportsViewProps {
  fridayReports: WeeklyReport[];
  workers: Worker[];
  onTriggerManualArchive: () => Promise<void>;
  onUploadReportToDrive: (report: WeeklyReport) => Promise<string | undefined>;
  onDeleteReport?: (reportId: string) => Promise<void>;
  onSendToAdminWa?: () => Promise<void>;
  driveConnected: boolean;
  googleDriveToken?: string;
}

export const FridayReportsView: React.FC<FridayReportsViewProps> = ({
  fridayReports,
  workers,
  onTriggerManualArchive,
  onUploadReportToDrive,
  onDeleteReport,
  onSendToAdminWa,
  driveConnected,
  googleDriveToken,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualArchiving, setManualArchiving] = useState(false);
  const [sendingToWa, setSendingToWa] = useState(false);

  // Google Drive Permanent Connection State
  const [showDriveConfig, setShowDriveConfig] = useState(false);
  const [driveStatus, setDriveStatus] = useState<{
    isConnected: boolean;
    isPermanent: boolean;
    userEmail?: string;
    accountEmail?: string;
    clientId?: string;
    rawClientId?: string;
    expiresAt?: number;
    hasRefreshToken?: boolean;
    hasToken?: boolean;
    hasClientSecret?: boolean;
    currentOrigin?: string;
    suggestedRedirectUri?: string;
  }>({
    isConnected: driveConnected,
    isPermanent: false,
  });
  const [loadingDriveStatus, setLoadingDriveStatus] = useState(false);
  const { user: authUser, profile } = useAuth();
  const [firebaseLoading, setFirebaseLoading] = useState(false);
  const [loggingInGoogle, setLoggingInGoogle] = useState(false);
  const [redirectingOAuth, setRedirectingOAuth] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    email?: string;
  } | null>(null);

  // Inputs for Permanent Connection
  const [inputRefreshToken, setInputRefreshToken] = useState("");
  const [inputAccessToken, setInputAccessToken] = useState("");
  const [inputClientId, setInputClientId] = useState("");
  const [inputClientSecret, setInputClientSecret] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState("");

  // Diagnostic and Origin helpers
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  const [copiedScope, setCopiedScope] = useState(false);
  const [showOriginFixHelp, setShowOriginFixHelp] = useState(false);
  const [activeSetupTab, setActiveSetupTab] = useState<"playground" | "gis" | "manual">("playground");

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const currentRedirectUri = `${currentOrigin}/api/drive/oauth2callback`;

  // Google Drive Files and Management State
  const [driveFiles, setDriveFiles] = useState<
    Array<{ id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }>
  >([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [deletingDriveFileId, setDeletingDriveFileId] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Fetch Drive status from server
  const fetchDriveStatus = async () => {
    setLoadingDriveStatus(true);
    try {
      const res = await fetch("/api/drive/status");
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
        if (data.rawClientId && !inputClientId) {
          setInputClientId(data.rawClientId);
        }
      }
    } catch (e) {
      console.error("Gagal memuat status Google Drive:", e);
    } finally {
      setLoadingDriveStatus(false);
    }
  };

  // Fetch files currently inside Google Drive
  const fetchDriveFiles = async () => {
    setLoadingDriveFiles(true);
    try {
      const res = await fetch("/api/drive/files");
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setDriveFiles(data.files);
      }
    } catch (err) {
      console.error("Gagal memuat berkas Drive:", err);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  useEffect(() => {
    fetchDriveStatus();

    // Check URL parameters for OAuth feedback
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("drive_connected") === "true") {
        setConfigSuccessMsg(
          "Akun Google Drive berhasil terhubung permanen! Sistem otomatis memperbarui token akses di latar belakang."
        );
        window.history.replaceState({}, "", window.location.pathname);
      } else if (params.get("drive_error")) {
        const err = params.get("drive_error");
        setTestResult({
          success: false,
          message: `Gagal otorisasi Google: ${err}. Pastikan akun terdaftar di Test Users Google Cloud Console jika project dalam mode Testing.`,
        });
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (driveStatus.isConnected) {
      fetchDriveFiles();
    }
  }, [driveStatus.isConnected]);

  // Firebase Google Authentication with Google Drive scope
  const handleLoginFirebase = async () => {
    setFirebaseLoading(true);
    try {
      const { user, cancelled, error } = await signInWithGoogle();
      if (cancelled) {
        // User closed the popup window - smooth cancel
        return;
      }
      if (error) {
        setTestResult({
          success: false,
          message: error,
        });
        return;
      }
      if (user) {
        setConfigSuccessMsg(
          `Berhasil terhubung dengan Google Drive via Firebase Authentication (${user.email})!`
        );
        await fetchDriveStatus();
        await fetchDriveFiles();
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        console.error("Firebase Google Auth error:", err);
        setTestResult({
          success: false,
          message: "Gagal masuk dengan Google via Firebase: " + (err.message || err),
        });
      }
    } finally {
      setFirebaseLoading(false);
    }
  };

  // 1-Click Login via Official Web Redirect OAuth
  const handleLoginGoogleDrive = () => {
    window.location.href = "/api/drive/login";
  };

  // Disconnect Google Drive
  const handleDisconnectDrive = async () => {
    if (!confirm("Apakah Anda yakin ingin memutuskan sambungan akun Google Drive?")) {
      return;
    }
    try {
      const res = await fetch("/api/drive/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Koneksi Google Drive berhasil diputuskan.");
        setDriveStatus({ isConnected: false, isPermanent: false });
        setDriveFiles([]);
        setTestResult(null);
        setConfigSuccessMsg("");
      } else {
        alert(data.error || "Gagal memutuskan sambungan");
      }
    } catch (err: any) {
      alert("Gagal menghubungi server: " + err.message);
    }
  };

  // Delete a file directly in Google Drive
  const handleDeleteDriveFile = async (fileId: string, fileName: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus berkas "${fileName}" langsung dari Google Drive? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    setDeletingDriveFileId(fileId);
    try {
      const res = await fetch(`/api/drive/files/${fileId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert(`Berkas "${fileName}" berhasil dihapus dari Google Drive.`);
        await fetchDriveFiles();
      } else {
        alert(data.error || "Gagal menghapus berkas dari Google Drive.");
      }
    } catch (err: any) {
      alert("Gagal menghapus berkas: " + err.message);
    } finally {
      setDeletingDriveFileId(null);
    }
  };

  // Save manual / custom credentials (optional advanced)
  const handleSaveAdvancedConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg("");
    try {
      const payload: any = {};
      if (inputClientId.trim()) payload.clientId = inputClientId.trim();
      if (inputClientSecret.trim()) payload.clientSecret = inputClientSecret.trim();

      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi");
      }
      setConfigSuccessMsg("Pengaturan Client ID berhasil disimpan!");
      await fetchDriveStatus();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan konfigurasi");
    } finally {
      setSavingConfig(false);
    }
  };

  const copyToClipboard = (text: string, type: "origin" | "redirect" | "scope") => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "origin") {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2000);
      } else if (type === "redirect") {
        setCopiedRedirectUri(true);
        setTimeout(() => setCopiedRedirectUri(false), 2000);
      } else if (type === "scope") {
        setCopiedScope(true);
        setTimeout(() => setCopiedScope(false), 2000);
      }
    }
  };

  const handleManualArchive = async () => {
    if (!confirm("Simpan sekarang absensi PDF hari ini ke Google Drive (simulasi jam pulang kerja 17:00 WIB)?\n\nCatatan: Jika berkas untuk periode minggu ini sudah ada, sistem akan mengupdate file tersebut tanpa membuat duplikat.")) return;
    setManualArchiving(true);
    try {
      const res = await fetch("/api/daily/trigger-closing-autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan ke Google Drive");
      }
      alert(`Berhasil! Laporan absensi PDF telah disimpan ke Google Drive / arsip server:\n${data.driveUrl || "Folder: absen > " + data.report?.monthName + " > " + data.report?.periodName}`);
      await onTriggerManualArchive();
    } catch (e: any) {
      alert(e.message || "Gagal mengarsipkan laporan");
    } finally {
      setManualArchiving(false);
    }
  };

  const handleSendToAdminWa = async () => {
    if (!confirm("Kirim dokumen PDF mingguan dan tautan Google Drive ke nomor WhatsApp Admin sekarang?")) return;
    setSendingToWa(true);
    try {
      const res = await fetch("/api/friday/send-to-wa-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengirim ke WhatsApp Admin");
      }
      if (data.sentToAdminWa) {
        alert(`Sukses! Dokumen PDF dan tautan Google Drive berhasil dikirimkan ke WhatsApp Admin (${data.adminPhone}).`);
      } else {
        alert(`Laporan tersimpan di Google Drive, namun pengiriman WhatsApp gagal atau nomor admin belum terdaftar/koneksi bot belum aktif.`);
      }
      await onTriggerManualArchive();
    } catch (e: any) {
      alert(e.message || "Gagal mengirim ke WhatsApp Admin");
    } finally {
      setSendingToWa(false);
    }
  };

  const handleUploadDrive = async (report: WeeklyReport) => {
    setProcessingId(report.id);
    try {
      const url = await onUploadReportToDrive(report);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e: any) {
      alert(e.message || "Gagal mengunggah ke Google Drive");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReport = async (report: WeeklyReport) => {
    const periodName = report.periodName || report.id;
    if (!confirm(`Hapus laporan "${periodName}" dari daftar riwayat laporan absen?`)) {
      return;
    }

    setDeletingId(report.id);
    try {
      if (onDeleteReport) {
        await onDeleteReport(report.id);
      } else {
        const res = await fetch("/api/friday/delete-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: report.id }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Gagal menghapus laporan");
        }
        await onTriggerManualArchive();
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus laporan");
    } finally {
      setDeletingId(null);
    }
  };

  // Test live connection
  const handleTestConnection = async () => {
    setTestingDrive(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/drive/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          success: false,
          message: data.error || "Gagal terhubung ke Google Drive",
        });
      } else {
        setTestResult({
          success: true,
          message: `Koneksi Google Drive Berhasil Aktif! Folder utama '${data.folderStatus}'.`,
          email: data.userEmail,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal menghubungi server",
      });
    } finally {
      setTestingDrive(false);
    }
  };

  // 1-Click Google Sign-In via Google Identity Services
  const handleGoogleSignIn = () => {
    const targetClientId =
      inputClientId.trim() ||
      driveStatus?.rawClientId ||
      "1013398485215-gdtkp63vcjc0rehojrrjriqi42epp9hp.apps.googleusercontent.com";

    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
      setLoggingInGoogle(true);
      setConfigSuccessMsg("");
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: targetClientId,
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
          error_callback: (err: any) => {
            console.error("Google OAuth error_callback:", err);
            setShowOriginFixHelp(true);
            setLoggingInGoogle(false);
          },
          callback: async (response: any) => {
            if (response.error) {
              console.warn("OAuth response error:", response.error);
              setShowOriginFixHelp(true);
              setLoggingInGoogle(false);
              return;
            }
            try {
              const res = await fetch("/api/drive/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: response.access_token,
                  clientId: targetClientId,
                }),
              });
              const data = await res.json();
              if (data.success) {
                setConfigSuccessMsg(
                  `Akun Google Drive berhasil terhubung! ${
                    data.testResult?.userEmail ? `(Akun: ${data.testResult.userEmail})` : ""
                  }`
                );
                await fetchDriveStatus();
                if (data.testResult?.success) {
                  setTestResult({
                    success: true,
                    message: `Koneksi Google Drive Aktif! (${data.testResult.folderStatus})`,
                    email: data.testResult.userEmail,
                  });
                }
              } else {
                alert(data.error || "Gagal menyimpan token Google Drive.");
              }
            } catch (err: any) {
              alert("Gagal menyimpan ke server: " + err.message);
            } finally {
              setLoggingInGoogle(false);
            }
          },
        });
        client.requestAccessToken({ prompt: "consent" });
      } catch (err: any) {
        setShowOriginFixHelp(true);
        setLoggingInGoogle(false);
      }
    } else {
      alert(
        "Google Identity Services belum siap. Mohon tunggu beberapa detik atau pastikan koneksi internet aktif, lalu muat ulang halaman."
      );
    }
  };

  // Start Web Redirect OAuth 2.0 flow
  const handleStartOAuthRedirect = async () => {
    const targetClientId =
      inputClientId.trim() ||
      driveStatus?.rawClientId;
    if (!targetClientId) {
      alert("Masukkan Client ID terlebih dahulu pada formulir di bawah.");
      return;
    }
    setRedirectingOAuth(true);
    try {
      const res = await fetch(`/api/drive/auth-url?clientId=${encodeURIComponent(targetClientId)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.error || "Gagal membuat URL otorisasi Google");
      }
      window.location.href = data.authUrl;
    } catch (e: any) {
      alert(e.message || "Gagal memulai otorisasi");
      setRedirectingOAuth(false);
    }
  };

  // Save permanent credentials
  const handleSaveDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg("");
    try {
      const payload: any = {};
      if (inputRefreshToken.trim()) payload.refreshToken = inputRefreshToken.trim();
      if (inputAccessToken.trim()) payload.token = inputAccessToken.trim();
      if (inputClientId.trim()) payload.clientId = inputClientId.trim();
      if (inputClientSecret.trim()) payload.clientSecret = inputClientSecret.trim();

      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi");
      }

      setConfigSuccessMsg("Pengaturan Google Drive berhasil disimpan dan terhubung!");
      await fetchDriveStatus();
      if (data.testResult?.success) {
        setTestResult({
          success: true,
          message: `Koneksi Google Drive Aktif! (${data.testResult.folderStatus})`,
          email: data.testResult.userEmail,
        });
      }
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan konfigurasi");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily 17:00 Closing & Anti-Duplicate Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                <h2 className="text-xl font-bold">Riwayat Laporan Absen (Auto-Save 17:00 WIB)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Anti-Duplikat Aktif
                </span>
                {driveStatus.isPermanent ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-1" />
                    Token Permanen 24/7
                  </span>
                ) : driveStatus.isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Drive Terhubung
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Drive Belum Terhubung
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Setiap hari kerja pada <strong>jam pulang kerja (17:00 WIB)</strong>, aplikasi otomatis menyimpan rekap absensi berformat <strong>PDF ke Google Drive</strong>.
                Dari hari <strong>Senin sampai Jumat</strong>, sistem selalu mengupdate <strong>1 file yang sama</strong> pada periode tersebut tanpa membuat duplikat baru. Khusus hari Jumat, admin bot WA otomatis menerima file PDF beserta tautannya.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-emerald-300">
                <div className="flex items-center space-x-1.5">
                  <FolderTree className="w-4 h-4" />
                  <span className="font-mono font-semibold">
                    Folder: absen &gt; [Bulan] &gt; [Periode]
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-teal-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1 Periode = 1 Berkas Terupdate (0 Duplikasi)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowDriveConfig(!showDriveConfig)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
              title="Konfigurasi token Google Drive permanen tanpa expired"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pengaturan Google Drive</span>
              {showDriveConfig ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </button>

            <button
              onClick={handleManualArchive}
              disabled={manualArchiving}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              title="Simpan berkas PDF absensi hari ini ke Google Drive langsung"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualArchiving ? "animate-spin" : ""}`} />
              <span>{manualArchiving ? "Menyimpan ke Drive..." : "Simpan PDF ke Drive (Jam Pulang)"}</span>
            </button>

            <button
              onClick={handleSendToAdminWa}
              disabled={sendingToWa}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              title="Kirim file PDF mingguan dan link Drive ke WA Admin bot"
            >
              <Send className={`w-3.5 h-3.5 ${sendingToWa ? "animate-pulse" : ""}`} />
              <span>{sendingToWa ? "Mengirim ke WA..." : "Kirim PDF ke WA Admin"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Drive Permanent Connection Panel */}
      {showDriveConfig && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-emerald-600" />
                <span>Penyambungan Akun Google Drive (Otomatis &amp; Permanen)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Aplikasi dapat langsung mengakses Google Drive untuk membuat, menyimpan, memperbarui, dan menghapus berkas laporan absensi secara otomatis.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {driveStatus.isConnected && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingDrive}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingDrive ? "animate-spin text-emerald-600" : ""}`} />
                  <span>{testingDrive ? "Menguji Koneksi..." : "Tes Koneksi Google Drive"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border text-xs flex items-start space-x-3 ${
              driveStatus.isConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            <ShieldCheck
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                driveStatus.isConnected ? "text-emerald-600" : "text-slate-400"
              }`}
            />
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-bold text-sm">
                  Status:{" "}
                  {driveStatus.isConnected
                    ? "🟢 Terhubung dengan Akun Google Drive"
                    : "⚪ Belum Terhubung dengan Akun Google"}
                </p>
                {driveStatus.userEmail && (
                  <span className="text-[11px] bg-white px-3 py-1 rounded-full border border-emerald-300 font-semibold text-emerald-900 shadow-2xs">
                    Akun: <strong>{driveStatus.userEmail}</strong>
                  </span>
                )}
              </div>
              <p className="leading-relaxed">
                {driveStatus.isConnected
                  ? "Aplikasi secara otomatis memperbarui token akses (auto-refresh) setiap kali mengakses Google Drive. Laporan absensi PDF otomatis disimpan dan diupdate pada jam pulang kerja (17:00 WIB) tanpa perlu memasukkan token sementara."
                  : "Cukup klik tombol Login di bawah untuk menyambungkan akun Google Anda. Tidak perlu lagi memasukkan token sementara secara manual."}
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2 ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>
                {testResult.message} {testResult.email && `(Akun: ${testResult.email})`}
              </span>
            </div>
          )}

          {configSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{configSuccessMsg}</span>
            </div>
          )}

          {/* CONNECTED STATE: Management & File List */}
          {driveStatus.isConnected ? (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 text-xs text-slate-600">
                  <FolderTree className="w-4 h-4 text-emerald-600" />
                  <span>
                    Folder Utama: <strong>absen &gt; [Bulan] &gt; [Periode]</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={fetchDriveFiles}
                    disabled={loadingDriveFiles}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDriveFiles ? "animate-spin text-emerald-600" : ""}`} />
                    <span>{loadingDriveFiles ? "Memuat..." : "Segarkan Berkas Drive"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 flex items-center gap-1.5 transition-colors"
                  >
                    <span>Putuskan / Ganti Akun Google</span>
                  </button>
                </div>
              </div>

              {/* Real-time Google Drive Files Section */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Berkas Laporan Absensi di Google Drive
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Total: {driveFiles.length} berkas
                  </span>
                </div>

                {loadingDriveFiles ? (
                  <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span>Menghubungi Google Drive...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs space-y-1">
                    <p className="font-semibold text-slate-600">Belum ada berkas laporan di Google Drive</p>
                    <p className="text-[11px] text-slate-400">
                      Klik tombol "Simpan PDF ke Drive (Jam Pulang)" di atas untuk membuat berkas PDF perdana di Google Drive.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-start space-x-2.5">
                          <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-slate-900 font-mono text-[11px]">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {file.modifiedTime
                                ? `Terakhir diperbarui: ${new Date(file.modifiedTime).toLocaleString("id-ID")}`
                                : "Tersimpan di Google Drive"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 border border-blue-200 transition-colors"
                            >
                              <span>Buka di Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDriveFile(file.id, file.name)}
                            disabled={deletingDriveFileId === file.id}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 border border-rose-200 transition-colors disabled:opacity-50"
                            title="Hapus berkas ini langsung dari Google Drive"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{deletingDriveFileId === file.id ? "Menghapus..." : "Hapus"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* NOT CONNECTED STATE: 1-Click Login & Friendly Guide */
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-blue-100 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center border border-slate-200">
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>

                <div className="max-w-md space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    Sambungkan Akun Google Drive (Firebase Auth)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Masuk secara instan menggunakan Firebase Authentication &amp; Google Sign-In (misal:{" "}
                    <strong>perusahaannmsa@gmail.com</strong>). Akses Google Drive akan terhubung otomatis untuk menyimpan seluruh arsip laporan mingguan.
                  </p>
                </div>

                {authUser && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 text-left w-full max-w-md">
                    {authUser.photoURL ? (
                      <img
                        src={authUser.photoURL}
                        alt="Profile"
                        className="w-8 h-8 rounded-full border border-emerald-400"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        {authUser.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-950 truncate">
                        {authUser.displayName || authUser.email}
                      </p>
                      <p className="text-[10px] text-emerald-700 truncate">{authUser.email}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800">
                      Terautentikasi
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto justify-center">
                  <button
                    type="button"
                    onClick={handleLoginFirebase}
                    disabled={firebaseLoading}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#ffffff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#ffffff"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{firebaseLoading ? "Menghubungkan..." : "Login dengan Google (Firebase Auth)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoginGoogleDrive}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Atau Login via Web Redirect OAuth</span>
                  </button>
                </div>
              </div>

              {/* Crucial Fix for "Akses Diblokir / Access Blocked" when Developer Account != Drive Account */}
              <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs text-amber-900">
                      Penting: Mengapa Akun Berbeda Diblokir Google ("Akses Diblokir: Error 403 / Belum Diverifikasi")?
                    </h5>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Karena OAuth Client dibuat di akun developer (<code>akuncoding211@gmail.com</code>), Google Cloud secara otomatis menyetel aplikasi dalam status <strong>"Testing" (Pengujian)</strong>. Pada status ini, Google hanya mengizinkan akun yang terdaftar di <strong>"Test users" (Pengguna Pengujian)</strong> untuk login.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-amber-200 text-[11px] text-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cara 1 Langkah agar akun perusahaannmsa@gmail.com tidak diblokir:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1 leading-relaxed">
                    <li>
                      Buka halaman consent Google Cloud:{" "}
                      <a
                        href="https://console.cloud.google.com/apis/credentials/consent"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 font-semibold underline inline-flex items-center gap-0.5"
                      >
                        console.cloud.google.com/apis/credentials/consent
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      Gulir ke bagian <strong>Test users (Pengguna pengujian)</strong>, klik tombol <strong>+ ADD USERS</strong>.
                    </li>
                    <li>
                      Ketik email: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-900">perusahaannmsa@gmail.com</code> lalu klik <strong>SAVE / SIMPAN</strong>.
                    </li>
                    <li>
                      Kembali ke sini dan klik tombol biru <strong>"Login &amp; Hubungkan Akun Google Drive"</strong> di atas. Login akan langsung berhasil 100%!
                    </li>
                  </ol>
                </div>
              </div>

              {/* Collapsible Advanced Credentials Form */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-slate-700 font-semibold transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Pengaturan Client ID &amp; Secret (Opsional / Lanjutan)</span>
                  </div>
                  {showAdvancedSettings ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showAdvancedSettings && (
                  <form onSubmit={handleSaveAdvancedConfig} className="p-4 bg-white space-y-3 border-t border-slate-200">
                    <p className="text-[11px] text-slate-500">
                      Sistem sudah mengonfigurasi Client ID default yang Anda daftarkan di Railway (<code>808277148256...</code>). Anda hanya perlu mengubah formulir ini jika membuat OAuth Client ID baru.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Client ID:
                        </label>
                        <input
                          type="text"
                          value={inputClientId}
                          onChange={(e) => setInputClientId(e.target.value)}
                          placeholder="808277148256-xxx.apps.googleusercontent.com"
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Client Secret:
                        </label>
                        <input
                          type="password"
                          value={inputClientSecret}
                          onChange={(e) => setInputClientSecret(e.target.value)}
                          placeholder="Masukkan Client Secret"
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        {savingConfig ? "Menyimpan..." : "Simpan Client ID"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Daftar Riwayat Laporan Absen</h3>
          </div>
          <span className="text-xs text-slate-500">Total: {fridayReports.length} Laporan Tersimpan</span>
        </div>

        {fridayReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Riwayat Laporan Tersimpan</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Laporan akan terisi otomatis setiap hari kerja pukul 17:00 WIB ke Google Drive, atau Anda dapat mengklik tombol "Simpan PDF ke Drive (Jam Pulang)" di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {fridayReports.map((report) => {
              const periodStr = report.periodName || `Periode ${report.weekStartDate} s/d ${report.weekEndDate}`;
              const monthStr = report.monthName || "September 2026";
              const driveFolderDisplay = `absen > ${monthStr} > ${periodStr}`;

              return (
                <div key={report.id} className="p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-900">{periodStr}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                          Format PDF
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[10px] border border-blue-200">
                          1 Berkas Terupdate Otomatis
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center space-x-2">
                          <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Folder Google Drive: <strong>{driveFolderDisplay}</strong>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Waktu Auto-Arsip: {report.autoSavedAt || report.submittedAt || "Jam Pulang 17:00 WIB"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-700 font-medium pt-1">
                          <span>Total Kehadiran: <strong>{report.totalPresent || 0} hari</strong></span>
                          <span>•</span>
                          <span>Total Uang Makan: <strong className="text-emerald-700">Rp {(report.totalCost || 0).toLocaleString("id-ID")}</strong> (Rp 25.000 /hari)</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-1.5">
                      <button
                        onClick={() => downloadWeeklyReportPDF(report, workers)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                        title="Unduh file PDF ke perangkat"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Unduh PDF</span>
                      </button>

                      {report.driveUrl ? (
                        <a
                          href={report.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                          title="Buka file di Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka di Drive</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => handleUploadDrive(report)}
                          disabled={processingId === report.id}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          title="Simpan atau perbarui file di Google Drive"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>{processingId === report.id ? "Mengunggah..." : "Simpan ke Drive"}</span>
                        </button>
                      )}

                      {/* Tombol Hapus Laporan */}
                      <button
                        onClick={() => handleDeleteReport(report)}
                        disabled={deletingId === report.id}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        title="Hapus laporan ini dari riwayat"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingId === report.id ? "animate-spin" : ""}`} />
                        <span>{deletingId === report.id ? "Menghapus..." : "Hapus"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
