/**
 * Server-side Google Drive helper for uploading attendance reports.
 * Folder structure: absen > [Bulan, e.g. September 2026] > [Periode, e.g. Periode 07-11 September 2026]
 * 
 * CRITICAL RULE:
 * Always updates the existing file in Google Drive if one already exists for the period.
 * From Monday to Friday, exactly 1 file exists and is updated daily without duplicates.
 */

export interface GoogleDriveUploadResult {
  fileId: string;
  driveUrl: string;
  folderPath: string;
  isUpdated: boolean;
}

export const DEFAULT_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "808277148256-068e724o8i43n3e5ghs58oru3ucbbvq2.apps.googleusercontent.com";
export const DEFAULT_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

/**
 * Refresh Google Drive OAuth 2.0 access token using a refresh token.
 */
export async function refreshGoogleDriveToken(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const cId = clientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
  const cSec = clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;

  if (!refreshToken) {
    throw new Error("Refresh token Google Drive tidak ditemukan.");
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (cId) params.append("client_id", cId);
  if (cSec) params.append("client_secret", cSec);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal me-refresh token Google Drive: ${errText}`);
  }

  const data: any = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Exchange Google OAuth authorization code for tokens (access_token + refresh_token)
 */
export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string,
  clientId?: string,
  clientSecret?: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const cId = clientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
  const cSec = clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;

  const params = new URLSearchParams({
    code,
    client_id: cId,
    client_secret: cSec,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menukar kode otorisasi Google: ${errText}`);
  }

  const data: any = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Test Google Drive connection by retrieving user info and verifying access to the 'absen' folder.
 */
export async function testGoogleDriveConnection(accessToken: string): Promise<{
  success: boolean;
  userEmail?: string;
  displayName?: string;
  folderStatus: string;
}> {
  // 1. Get user profile
  let userEmail: string | undefined = undefined;
  let displayName: string | undefined = undefined;
  try {
    const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (aboutRes.ok) {
      const aboutData: any = await aboutRes.json();
      userEmail = aboutData.user?.emailAddress;
      displayName = aboutData.user?.displayName;
    }
  } catch (e) {
    // Continue even if about fails
  }

  // 2. Verify / create 'absen' root folder
  const queryStr = `name = 'absen' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&spaces=drive&fields=files(id,name)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Gagal mengakses Google Drive: ${errText}`);
  }

  const searchData: any = await searchRes.json();
  let folderStatus = "Folder 'absen' sudah tersedia";
  if (!searchData.files || searchData.files.length === 0) {
    // Create folder 'absen'
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "absen",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    if (createRes.ok) {
      folderStatus = "Folder utama 'absen' berhasil dibuat otomatis";
    }
  }

  return {
    success: true,
    userEmail,
    displayName,
    folderStatus,
  };
}

/**
 * Upload or update attendance report PDF in Google Drive.
 * Guarantees that if a file with the same name already exists in the period folder,
 * it UPDATES that exact file in-place (no duplicates).
 */
export async function uploadPdfBufferToGoogleDrive(
  accessToken: string,
  monthName: string,
  periodName: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<GoogleDriveUploadResult> {
  const folderNames = ["absen", monthName, periodName];
  let currentParentId: string | undefined = undefined;

  for (const name of folderNames) {
    let queryStr = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (currentParentId) {
      queryStr += ` and '${currentParentId}' in parents`;
    }
    const query = encodeURIComponent(queryStr);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      throw new Error(`Gagal mencari folder Google Drive "${name}": ${errText}`);
    }

    const searchData: any = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      currentParentId = searchData.files[0].id;
    } else {
      // Create folder
      const meta: any = {
        name,
        mimeType: "application/vnd.google-apps.folder",
      };
      if (currentParentId) {
        meta.parents = [currentParentId];
      }
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(meta),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Gagal membuat folder Google Drive "${name}": ${errText}`);
      }
      const createData: any = await createRes.json();
      currentParentId = createData.id;
    }
  }

  // ==================== CHECK IF FILE ALREADY EXISTS IN THIS FOLDER ====================
  // Check by name and parent folder
  const fileQueryStr = `name = '${fileName.replace(/'/g, "\\'")}' and '${currentParentId}' in parents and trashed = false`;
  const fileQuery = encodeURIComponent(fileQueryStr);
  const searchFileUrl = `https://www.googleapis.com/drive/v3/files?q=${fileQuery}&spaces=drive&fields=files(id,name,webViewLink)`;

  const searchFileRes = await fetch(searchFileUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchFileRes.ok) {
    const searchFileData: any = await searchFileRes.json();
    if (searchFileData.files && searchFileData.files.length > 0) {
      // FILE EXISTS! UPDATE EXISTING FILE (DO NOT DUPLICATE)
      const existingFile = searchFileData.files[0];
      const existingFileId = existingFile.id;
      console.log(`[Google Drive] File "${fileName}" sudah ada di folder (ID: ${existingFileId}). Mengupdate file secara langsung tanpa membuat duplikat...`);

      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&fields=id,name,webViewLink`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/pdf",
          },
          body: pdfBuffer,
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Gagal mengupdate berkas PDF di Google Drive: ${errText}`);
      }

      const updateData: any = await updateRes.json();
      const fileId = updateData.id || existingFileId;
      const driveUrl = updateData.webViewLink || existingFile.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      console.log(`[Google Drive] Berhasil memperbarui file yang sudah ada: ${driveUrl}`);
      return {
        fileId,
        driveUrl,
        folderPath: `absen > ${monthName} > ${periodName}`,
        isUpdated: true,
      };
    }
  }

  // ==================== FILE DOES NOT EXIST: CREATE FIRST TIME ====================
  console.log(`[Google Drive] Membuat berkas baru "${fileName}" di folder (absen > ${monthName} > ${periodName})...`);

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [currentParentId!],
    mimeType: "application/pdf",
  };

  const multipartBody = Buffer.concat([
    Buffer.from(
      delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/pdf\r\n\r\n"
    ),
    pdfBuffer,
    Buffer.from(closeDelimiter),
  ]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal mengunggah PDF ke Google Drive: ${errText}`);
  }

  const uploadData: any = await uploadRes.json();
  const fileId = uploadData.id;
  const driveUrl = uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  console.log(`[Google Drive] Berhasil mengunggah file baru: ${driveUrl}`);

  return {
    fileId,
    driveUrl,
    folderPath: `absen > ${monthName} > ${periodName}`,
    isUpdated: false,
  };
}

/**
 * Delete a file in Google Drive by its fileId
 */
export async function deleteGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Gagal menghapus file di Google Drive: ${errText}`);
  }
  return true;
}

/**
 * List attendance files in Google Drive
 */
export async function listGoogleDriveAttendanceFiles(
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }>> {
  const queryStr = `mimeType = 'application/pdf' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&spaces=drive&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=20&orderBy=modifiedTime desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return [];
  }
  const data: any = await res.json();
  return data.files || [];
}
