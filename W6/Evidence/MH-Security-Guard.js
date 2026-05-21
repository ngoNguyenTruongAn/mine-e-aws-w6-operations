import {
  S3Client,
  GetPublicAccessBlockCommand,
  PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-1" });

const TARGET_BUCKET = process.env.TARGET_BUCKET;

export const handler = async (event) => {
  console.log("Mine-e S3 Security Guard triggered");
  console.log("Event:", JSON.stringify(event));

  if (!TARGET_BUCKET) {
    throw new Error("Missing TARGET_BUCKET environment variable");
  }

  let currentConfig = null;

  try {
    const result = await s3.send(
      new GetPublicAccessBlockCommand({
        Bucket: TARGET_BUCKET
      })
    );

    currentConfig = result.PublicAccessBlockConfiguration;
    console.log("Current PublicAccessBlock configuration:", currentConfig);
  } catch (error) {
    console.log("No PublicAccessBlock config found or failed to read config:", {
      name: error.name,
      message: error.message
    });
  }

  const requiredConfig = {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true
  };

  const isCompliant =
    currentConfig &&
    currentConfig.BlockPublicAcls === true &&
    currentConfig.IgnorePublicAcls === true &&
    currentConfig.BlockPublicPolicy === true &&
    currentConfig.RestrictPublicBuckets === true;

  if (isCompliant) {
    console.log("Bucket is already compliant. No remediation needed.");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Bucket already has full Block Public Access enabled",
        bucket: TARGET_BUCKET,
        remediated: false
      })
    };
  }

  console.log("Bucket is non-compliant. Enabling full Block Public Access.");

  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: TARGET_BUCKET,
      PublicAccessBlockConfiguration: requiredConfig
    })
  );

  console.log("PutPublicAccessBlock completed:", {
    bucket: TARGET_BUCKET,
    config: requiredConfig
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "S3 Block Public Access remediated",
      bucket: TARGET_BUCKET,
      remediated: true,
      config: requiredConfig
    })
  };
};