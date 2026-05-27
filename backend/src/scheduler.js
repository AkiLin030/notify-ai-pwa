const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const webpush = require("web-push");

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const snsClient = new SNSClient({});

const USERS_TABLE = process.env.USERS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// VAPID keys should ideally come from Secrets Manager or env vars
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "placeholder";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "placeholder";
webpush.setVapidDetails("mailto:test@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function generateReminderMessage(personality) {
  // Call Groq API
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Or preferred Groq model
        messages: [
          { role: "system", content: `You are an AI assistant with a ${personality} personality. Give a very short, one sentence reminder to the user to take a break or check their tasks.` }
        ]
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error("Groq API error:", err);
    return `[${personality} mode] 該休息一下了！`;
  }
}

async function sendDiscord(webhookUrl, message) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}

function isQuietHour(currentHour, start, end) {
  if (!start || !end) return false;
  const startHour = parseInt(start.split(":")[0]);
  const endHour = parseInt(end.split(":")[0]);
  
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Crosses midnight
    return currentHour >= startHour || currentHour < endHour;
  }
}

exports.handler = async (event) => {
  console.log("Scheduler triggered");
  
  // Get current hour in GMT+8 (Taiwan time)
  const date = new Date();
  date.setHours(date.getUTCHours() + 8);
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();

  try {
    // 1. Scan all users (In production, use GSI or query if dataset is huge)
    const { Items } = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
    
    if (!Items || Items.length === 0) return { statusCode: 200, body: "No users" };

    for (const user of Items) {
      // 2. Check Quiet Hours
      const quiet = user.quietHours || { start: "22:00", end: "07:00" };
      if (isQuietHour(currentHour, quiet.start, quiet.end)) {
        continue;
      }

      // 3. Check Reminder Times (Match specific frequencies)
      const schedules = user.schedules || [];
      const shouldRemind = schedules.some(s => {
        if (!s.frequency) return false;
        if (s.frequency === "minute") return true;
        if (s.frequency === "hour") return currentMinute === 0;
        if (!s.time) return false;
        
        if (s.frequency === "once") {
          const d = new Date(s.time);
          return d.getHours() === currentHour && d.getMinutes() === currentMinute && d.getDate() === date.getDate();
        }
        
        const [h, m] = s.time.split(":");
        const hourMatch = parseInt(h) === currentHour && parseInt(m) === currentMinute;
        
        if (s.frequency === "day") return hourMatch;
        if (s.frequency === "week") return hourMatch && date.getDay() === 1;
        if (s.frequency === "month") return hourMatch && date.getDate() === 1;
        
        return false;
      });
      
      if (!shouldRemind) continue;

      // 4. Generate Message via Groq
      const message = await generateReminderMessage(user.personality || "gentle");

      // 5. Send Notifications
      const channels = user.channels || {};
      
      // Email (SNS)
      if (channels.email && SNS_TOPIC_ARN) {
        await snsClient.send(new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Message: message,
          Subject: "AI 提醒助手"
        }));
      }

      // Discord
      if (channels.discord && user.discordWebhook) {
        await sendDiscord(user.discordWebhook, message);
      }

      // Web Push
      if (channels.webpush && user.webpushSubscription) {
        try {
          await webpush.sendNotification(user.webpushSubscription, JSON.stringify({ title: "AI 提醒", body: message }));
        } catch (err) {
          console.error("WebPush error:", err);
        }
      }

      // 6. Save Chat History
      const timestamp = `今天 ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
      const newMsg = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        sender: "ai",
        content: message,
        timestamp: timestamp,
        reactions: []
      };
      
      const currentHistory = user.chatHistory || [];
      currentHistory.push(newMsg);
      // Keep only last 50
      if (currentHistory.length > 50) {
        currentHistory.splice(0, currentHistory.length - 50);
      }
      
      try {
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: user.userId },
          UpdateExpression: "SET chatHistory = :history",
          ExpressionAttributeValues: { ":history": currentHistory }
        }));
      } catch (err) {
        console.error("Failed to update history for user", user.userId, err);
      }
    }

    return { statusCode: 200, body: "Reminders processed" };
  } catch (error) {
    console.error("Scheduler Error:", error);
    return { statusCode: 500, body: "Error processing reminders" };
  }
};
