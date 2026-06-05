const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const { SNSClient, SubscribeCommand, UnsubscribeCommand, ListSubscriptionsByTopicCommand } = require("@aws-sdk/client-sns");
const snsClient = new SNSClient({});

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = process.env.USERS_TABLE;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const { httpMethod, path, body } = event;

    // Simulate User ID extraction from Authorization Header (JWT)
    // For this prototype, we'll accept a mock header or default user.
    const userId = event.headers?.Authorization?.split(" ")[1] || "user_12345";

    if (httpMethod === "GET") {
      const { Item } = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId },
        })
      );
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(Item || {}),
      };
    }

    if (httpMethod === "POST") {
      const data = JSON.parse(body || "{}");

      if (data.action === "addReaction") {
        const { messageId, emoji } = data;
        const { Item } = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
        if (Item && Item.chatHistory) {
          const newHistory = Item.chatHistory.map(msg => {
            if (msg.id === messageId) {
              if (!msg.reactions) msg.reactions = [];
              if (msg.reactions.includes(emoji)) {
                msg.reactions = msg.reactions.filter(e => e !== emoji);
              } else {
                msg.reactions.push(emoji);
              }
            }
            return msg;
          });
          await docClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { userId },
            UpdateExpression: "SET chatHistory = :h",
            ExpressionAttributeValues: { ":h": newHistory }
          }));
        }
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: "Reaction toggled" }) };
      }
      
      const item = { userId, ...data };
      
      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE,
          Item: item,
        })
      );

      if (item.channels?.email && userId.includes("@")) {
        try {
          await snsClient.send(
            new SubscribeCommand({
              TopicArn: process.env.SNS_TOPIC_ARN,
              Protocol: "email",
              Endpoint: userId,
            })
          );
          console.log(`Sent SNS subscription request to ${userId}`);
        } catch (snsErr) {
          console.error("Error subscribing to SNS:", snsErr);
        }
      } else if (item.channels?.email === false && userId.includes("@")) {
        // Auto-unsubscribe from SNS if email is disabled
        try {
          const listRes = await snsClient.send(new ListSubscriptionsByTopicCommand({ TopicArn: process.env.SNS_TOPIC_ARN }));
          const sub = listRes.Subscriptions.find(s => s.Endpoint === userId && s.SubscriptionArn !== "PendingConfirmation");
          if (sub) {
            await snsClient.send(new UnsubscribeCommand({ SubscriptionArn: sub.SubscriptionArn }));
            console.log(`Unsubscribed ${userId}`);
          }
        } catch (snsErr) {
          console.error("Error unsubscribing from SNS:", snsErr);
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Settings saved successfully", item }),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Not found" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};
