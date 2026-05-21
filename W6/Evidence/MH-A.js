import { ECSClient, DescribeServicesCommand, UpdateServiceCommand } from "@aws-sdk/client-ecs";

const ecs = new ECSClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const CLUSTER_NAME = process.env.CLUSTER_NAME;
const SERVICE_NAME = process.env.SERVICE_NAME;

export const handler = async (event) => {
  console.log("Mine-e Cost Guard triggered");
  console.log("Event:", JSON.stringify(event));

  if (!CLUSTER_NAME || !SERVICE_NAME) {
    throw new Error("Missing CLUSTER_NAME or SERVICE_NAME environment variables");
  }

  const beforeResult = await ecs.send(
    new DescribeServicesCommand({
      cluster: CLUSTER_NAME,
      services: [SERVICE_NAME]
    })
  );

  const beforeService = beforeResult.services?.[0];

  console.log("Before UpdateService:", {
    cluster: CLUSTER_NAME,
    serviceName: beforeService?.serviceName,
    desiredCount: beforeService?.desiredCount,
    runningCount: beforeService?.runningCount,
    status: beforeService?.status
  });

  const updateResult = await ecs.send(
    new UpdateServiceCommand({
      cluster: CLUSTER_NAME,
      service: SERVICE_NAME,
      desiredCount: 0
    })
  );

  console.log("After UpdateService called:", {
    cluster: CLUSTER_NAME,
    serviceName: updateResult.service?.serviceName,
    desiredCount: updateResult.service?.desiredCount,
    runningCount: updateResult.service?.runningCount,
    status: updateResult.service?.status
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Mine-e Cost Guard scaled ECS Service down to desiredCount=0",
      cluster: CLUSTER_NAME,
      service: SERVICE_NAME
    })
  };
};