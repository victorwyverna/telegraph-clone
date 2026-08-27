import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getFile(key: string) {
  const object = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }),
  );

  if (!object.Body) {
    throw new Error('File body is missing');
  }

  return {
    body: Buffer.from(await object.Body.transformToByteArray()),
    contentType: object.ContentType ?? 'application/octet-stream',
  };
}
