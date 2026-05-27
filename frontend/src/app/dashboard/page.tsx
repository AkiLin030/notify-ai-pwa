"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import styles from "./chat.module.css";
import { Settings, Bell, Bot, Plus } from "lucide-react";

type Message = {
  id: string;
  sender: "ai";
  content: string;
  timestamp: string;
  reactions: string[];
};

// Helper to generate dynamic, non-hardcoded timestamps
const getFormattedTime = (minutesOffset = 0) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutesOffset);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `今天 ${hours}:${minutes}`;
};

// Initial Mock Messages
const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    sender: "ai",
    content: "👋 歡迎使用 Notify AI ！我是你的專屬提醒管家。\n你可以在設定中調整「提醒時間」、「我的個性」與「提醒事項」，我會牢牢記住的！",
    timestamp: getFormattedTime(2),
    reactions: [],
  },
  {
    id: "2",
    sender: "ai",
    content: "📢 【Discord Webhook 設定教學】\n\n要讓我在 Discord 頻道中提醒你，請按照以下步驟設定：\n1. 進入你的 Discord 伺服器，選擇一個接收提醒的頻道。\n2. 左鍵點擊頻道名稱旁的 ⚙️「編輯頻道」按鈕。\n3. 選擇左側選單的「整合」 > 點擊「建立 Webhook」。\n4. 點擊新產生的 Webhook 機器人，按「複製 Webhook 網址」。\n5. 點擊本頁面右上角的 ⚙️「帳戶設定」前往設定頁，貼上 Webhook 網址，並選擇你喜歡的提醒時間與 AI 個性，最後按下儲存即可！",
    timestamp: getFormattedTime(1),
    reactions: ["👍"],
  },
  {
    id: "3",
    sender: "ai",
    content: "💡 【功能介紹】\n\n• 🌟 豐富的個性：你可以在設定頁面中自訂性格，打造你舒適的頻率。\n• ⏰ 彈性的提醒時間：支援每分鐘、每小時、每天、每週、每月，甚至是不重複的指定日期，並能精確設定時間！\n• ⛔ 靜音禁區時間：不想在半夜或上班被打擾？開啟「禁區時間」滑桿，即可在設定的區間內暫停所有發送。",
    timestamp: getFormattedTime(0),
    reactions: [],
  }
];

const EMOJI_REPLIES = ["👍", "❤️", "😂", "😡", "🙏", "💧"];

export default function ChatInterface() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Fetch data from backend on load
  useEffect(() => {
    if (user && process.env.NEXT_PUBLIC_API_URL) {
      fetch(process.env.NEXT_PUBLIC_API_URL, {
        headers: { "Authorization": `Bearer ${user.email}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.chatHistory) {
          setMessages([...INITIAL_MESSAGES, ...data.chatHistory]);
        }
      })
      .catch(console.error);
    }
  }, [user]);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAddReaction = async (messageId: string, emoji: string) => {
    // 1. Optimistic update
    setMessages(messages.map(m => {
      if (m.id === messageId) {
        if (m.reactions.includes(emoji)) return m; // prevent duplicate same emoji from user
        return { ...m, reactions: [...m.reactions, emoji] };
      }
      return m;
    }));
    setActivePickerId(null);

    // 2. Send to backend
    if (user && process.env.NEXT_PUBLIC_API_URL) {
      try {
        await fetch(process.env.NEXT_PUBLIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.email}`
          },
          body: JSON.stringify({
            action: "addReaction",
            messageId,
            emoji
          })
        });
      } catch (err) {
        console.error("Failed to add reaction:", err);
      }
    }
  };

  if (loading || !user) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <Bell className="text-gradient" size={22} />
            <h2>提醒紀錄</h2>
          </div>
          <div className={styles.userInfo}>
            <button className={styles.settingsLink} onClick={() => router.push("/settings")}>
              <Settings size={18} />
              <span>帳戶設定</span>
            </button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className={styles.chatArea} ref={chatAreaRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageWrapper} ${styles[msg.sender]}`}>
            <div className={styles.avatar}>
              <Bot size={20} />
            </div>
            
            <div className={styles.reactionContainer}>
              <div>
                <div className={styles.messageBubble}>
                  {msg.content}
                </div>
                {msg.reactions.length > 0 && (
                  <div className={styles.reactionsList}>
                    {msg.reactions.map((emoji, i) => (
                      <span key={i} className={styles.reactionBadge}>{emoji} 1</span>
                    ))}
                  </div>
                )}
                <span className={styles.timestamp}>{msg.timestamp}</span>
              </div>

              {/* Reaction Plus Button */}
              <button 
                className={styles.addReactionBtn} 
                onClick={() => setActivePickerId(activePickerId === msg.id ? null : msg.id)}
              >
                <Plus size={16} />
              </button>

              {/* Reaction Picker Popover */}
              {activePickerId === msg.id && (
                <div className={styles.reactionPicker}>
                  {EMOJI_REPLIES.map(emoji => (
                    <span 
                      key={emoji} 
                      className={styles.reactionEmoji}
                      onClick={() => handleAddReaction(msg.id, emoji)}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
