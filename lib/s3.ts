
// import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import { createS3Client, getBucketConfig } from './aws-config';

// const s3Client = createS3Client();
// const { bucketName, folderPrefix } = getBucketConfig();

// export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
//   const key = `${folderPrefix}${fileName}`;
  
//   await s3Client.send(
//     new PutObjectCommand({
//       Bucket: bucketName,
//       Key: key,
//       Body: buffer,
//     })
//   );

//   return key;
// }

// export async function deleteFile(key: string): Promise<void> {
//   await s3Client.send(
//     new DeleteObjectCommand({
//       Bucket: bucketName,
//       Key: key,
//     })
//   );
// }

// export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
//   const command = new GetObjectCommand({
//     Bucket: bucketName,
//     Key: key,
//   });

//   return await getSignedUrl(s3Client, command, { expiresIn });
// }

// export async function renameFile(oldKey: string, newKey: string): Promise<void> {
//   // S3 doesn't support rename, so we need to copy and delete
//   // For now, just return - in practice, we'll keep the same key
//   return;
// }
