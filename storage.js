// S3-compatible storage abstraction
// Works with MinIO (self-hosted) and AWS S3 (cloud)
// To migrate to AWS: change S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, set S3_FORCE_PATH_STYLE=false

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const crypto = require('node:crypto');
const path = require('node:path');

const BUCKET = process.env.S3_BUCKET || 'aichats';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', // true for MinIO, false for AWS S3
});

// File categories based on MIME type
const TEXT_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/xml', 'text/xml', 'application/x-yaml', 'text/yaml',
  'text/x-python', 'text/x-java', 'text/x-c', 'text/x-shellscript',
  'application/x-sh', 'text/tab-separated-values', 'text/rtf',
]);

const DOCUMENT_MIMES = new Set([
  'application/pdf',
]);

function categorizeFile(mimeType) {
  if (!mimeType) return 'other';
  const mime = mimeType.toLowerCase();
  if (TEXT_MIMES.has(mime) || mime.startsWith('text/')) return 'text';
  if (DOCUMENT_MIMES.has(mime)) return 'document';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

function isFreeAllowed(mimeType) {
  return categorizeFile(mimeType) === 'text';
}

function getExtension(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  return ext || '.bin';
}

function buildStoragePath(userId, conversationId, fileName) {
  const id = crypto.randomUUID();
  const ext = getExtension(fileName);
  return `${userId}/${conversationId}/${id}${ext}`;
}

async function uploadFile({ userId, conversationId, fileName, mimeType, buffer }) {
  const storagePath = buildStoragePath(userId, conversationId, fileName);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    Body: buffer,
    ContentType: mimeType,
    Metadata: { 'original-name': fileName },
  }));

  return {
    storagePath,
    fileSize: buffer.length,
    fileCategory: categorizeFile(mimeType),
  };
}

async function getFile(storagePath) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
  }));

  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    metadata: response.Metadata,
  };
}

async function deleteFile(storagePath) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
  }));
}

async function deleteConversationFiles(userId, conversationId) {
  const prefix = `${userId}/${conversationId}/`;
  let continuationToken;
  let totalDeleted = 0;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    const objects = (list.Contents || []).map((obj) => ({ Key: obj.Key }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objects },
      }));
      totalDeleted += objects.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalDeleted;
}

// ─── Ticket file storage ────────────────────────────────────────────────────

function buildTicketStoragePath(ticketId, fileName) {
  const id = crypto.randomUUID();
  const ext = getExtension(fileName);
  return `tickets/${ticketId}/${id}${ext}`;
}

async function uploadTicketFile({ storagePath, buffer, mimeType, fileName }) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    Body: buffer,
    ContentType: mimeType,
    Metadata: { 'original-name': fileName },
  }));
  return { storagePath, fileSize: buffer.length };
}

async function deleteTicketFiles(ticketId) {
  const prefix = `tickets/${ticketId}/`;
  let continuationToken;
  let totalDeleted = 0;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken,
    }));
    const objects = (list.Contents || []).map((obj) => ({ Key: obj.Key }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } }));
      totalDeleted += objects.length;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalDeleted;
}

module.exports = {
  categorizeFile,
  isFreeAllowed,
  uploadFile,
  getFile,
  deleteFile,
  deleteConversationFiles,
  buildTicketStoragePath,
  uploadTicketFile,
  deleteTicketFiles,
};
