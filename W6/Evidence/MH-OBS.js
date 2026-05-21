import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const TABLE_NAME = process.env.TABLE_NAME;
const METRIC_NAMESPACE = process.env.METRIC_NAMESPACE || "MineE/Media";

export const handler = async (event) => {
  console.log("Mine-e media observability Lambda triggered");
  console.log("Raw event:", JSON.stringify(event));

  if (!TABLE_NAME) {
    throw new Error("Missing TABLE_NAME environment variable");
  }

  const records = event.Records || [];
  console.log(`Received ${records.length} S3 record(s)`);

  for (const record of records) {
    const bucket = record.s3?.bucket?.name;
    const key = decodeURIComponent(record.s3?.object?.key?.replace(/\+/g, " ") || "");
    const size = record.s3?.object?.size || 0;
    const eventTime = record.eventTime || new Date().toISOString();

    const mediaId = `${bucket}/${key}/${Date.now()}`;

    console.log("Processing media object:", {
      mediaId,
      bucket,
      key,
      size,
      eventTime
    });

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          mediaId: { S: mediaId },
          bucket: { S: bucket },
          objectKey: { S: key },
          sizeBytes: { N: String(size) },
          eventTime: { S: eventTime },
          source: { S: "s3-object-created" },
          application: { S: "Mine-e" },
          environment: { S: "dev" }
        }
      })
    );

    console.log("DynamoDB PutItem completed:", mediaId);

    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: METRIC_NAMESPACE,
        MetricData: [
          {
            MetricName: "MediaUploadCount",
            Value: 1,
            Unit: "Count",
            Dimensions: [
              {
                Name: "Application",
                Value: "Mine-e"
              },
              {
                Name: "Environment",
                Value: "dev"
              }
            ]
          },
          {
            MetricName: "MediaUploadBytes",
            Value: size,
            Unit: "Bytes",
            Dimensions: [
              {
                Name: "Application",
                Value: "Mine-e"
              },
              {
                Name: "Environment",
                Value: "dev"
              }
            ]
          }
        ]
      })
    );

    console.log("CloudWatch custom metrics published:", {
      MediaUploadCount: 1,
      MediaUploadBytes: size
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Media observability processed successfully",
      recordCount: records.length
    })
  };
};