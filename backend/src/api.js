const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

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
      const item = { userId, ...data };
      
      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE,
          Item: item,
        })
      );

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
