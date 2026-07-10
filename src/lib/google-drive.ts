import { Readable } from "node:stream";
import { google } from "googleapis";

export const SCREENSHOT_FOLDER_ID = process.env.GOOGLE_DRIVE_SCREENSHOT_FOLDER_ID ?? "1s_Qd4eiBOyDnPtTGfCFuWHbI385IH8ff";

function getPrivateKey() {
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
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
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}.${extension}`;
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
