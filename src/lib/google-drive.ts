import { Readable } from "node:stream";
import { google } from "googleapis";

export const SCREENSHOT_FOLDER_ID = process.env.GOOGLE_DRIVE_SCREENSHOT_FOLDER_ID ?? "1s_Qd4eiBOyDnPtTGfCFuWHbI385IH8ff";

function getPrivateKey() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!privateKey) return undefined;

  if (privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    return privateKey;
  }

  return `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
}

export function getDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

export async function uploadScreenshotToDrive(file: File) {
  const drive = getDriveClient();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const filename = `screenshot-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [SCREENSHOT_FOLDER_ID],
    },
    media: {
      mimeType: file.type,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("Google Drive upload did not return a file ID.");
  }

  return response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`;
}

export function getDriveFileIdFromUrl(url?: string | null) {
  if (!url) return null;

  const filePathMatch = url.match(/\/file\/d\/([^/]+)/);
  if (filePathMatch?.[1]) return filePathMatch[1];

  const idParamMatch = url.match(/[?&]id=([^&]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return null;
}

export async function deleteDriveFileByUrl(url?: string | null) {
  const fileId = getDriveFileIdFromUrl(url);
  if (!fileId) return;

  const drive = getDriveClient();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
