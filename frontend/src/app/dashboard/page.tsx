"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import styles from "./chat.module.css";
import { Settings, Bell, Bot, Plus, Loader2 } from "lucide-react";

type Message = {
  id: string;
  sender: "ai";
  content: string;
  timestamp: string;
  reactions: string[];
};

const getFormattedTime = (minutesOffset = 0) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
};

const formatMessageTime = (timestampStr: string) => {
  if (!timestampStr) return "";
  // Check if it's a legacy timestamp (e.g., "今天 20:00")
  if (timestampStr.startsWith("今天") || !timestampStr.includes("T")) {
    return timestampStr;
  }
  
  const date = new Date(timestampStr);
  if (isNaN(date.getTime())) return timestampStr;

  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (isToday) return `今天 ${hours}:${minutes}`;
  if (isYesterday) return `昨天 ${hours}:${minutes}`;
  
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ChatInterface() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const [fullSettings, setFullSettings] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeen = localStorage.getItem('notifyAI_hasSeenOnboarding');
    if (!hasSeen) {
      setShowOnboarding(true);
    }
  }, []);

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
        if (data) {
          setFullSettings(data);
          if (data.chatHistory) {
            setMessages([...INITIAL_MESSAGES, ...data.chatHistory]);
          }
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

  const handleEnablePush = async () => {
    try {
      setIsEnablingPush(true);
      
      if (!('Notification' in window)) {
        alert("⚠️ 您的瀏覽器 (或 iOS Safari) 目前不支援推播。\n\n【iPhone 用戶請注意】\nApple 規定必須先將網站「加入主畫面」才能開啟通知！請點擊 Safari 下方的「分享」按鈕 ⬆️，選擇「加入主畫面」，然後從桌面的 APP 圖示開啟本程式即可！");
        setIsEnablingPush(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("您拒絕了推播權限。如果想要開啟，請去瀏覽器設定中解鎖喔！");
        skipOnboarding();
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      });

      // Save to backend with the full settings object
      if (user && process.env.NEXT_PUBLIC_API_URL) {
        const updatedSettings = {
          ...fullSettings,
          channels: { ...(fullSettings?.channels || {}), webpush: true },
          webpushSubscription: subscription
        };

        const res = await fetch(process.env.NEXT_PUBLIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.email}`
          },
          body: JSON.stringify(updatedSettings)
        });

        if (!res.ok) throw new Error("儲存失敗");
        setFullSettings(updatedSettings);
      }

      // Success
      localStorage.setItem('notifyAI_hasSeenOnboarding', 'true');
      setShowOnboarding(false);
      alert("太棒了！推播設定完成 🎉");
    } catch (err) {
      console.error(err);
      alert("設定推播時發生錯誤，請稍後再試。");
    } finally {
      setIsEnablingPush(false);
    }
  };

  const skipOnboarding = () => {
    alert("沒問題！如果你稍後想開啟推播，可以點擊右上角到「設定」頁面，在最下方的『通知方式』勾選系統推播喔！");
    localStorage.setItem('notifyAI_hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    // 1. Optimistic update
    setMessages(messages.map(m => {
      if (m.id === messageId) {
        if (m.reactions.includes(emoji)) {
          return { ...m, reactions: m.reactions.filter(e => e !== emoji) };
        }
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

      {/* Onboarding Overlay Modal */}
      {showOnboarding && (
        <div className={styles.onboardingOverlay}>
          <div className={styles.onboardingModal}>
            <div className={styles.onboardingTitle}>
              <Bell size={28} className="text-gradient" />
              <span>歡迎使用 Notify AI</span>
            </div>
            <p className={styles.onboardingText}>
              我是您的專屬 AI 助理！為了能在您關閉網頁時也能準時提醒您，
              請幫我開啟<strong>系統推播</strong>權限。
            </p>
            <button 
              className={styles.onboardingBtn} 
              onClick={handleEnablePush}
              disabled={isEnablingPush}
            >
              {isEnablingPush ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 size={18} className="animate-spin" /> 開啟中...
                </span>
              ) : (
                "🛎️ 一鍵開啟系統推播"
              )}
            </button>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                onClick={() => alert("【iPhone 用戶請注意】\nApple 規定必須先將網站「加入主畫面」才能開啟通知！\n\n1. 請點擊 Safari 下方的「分享」按鈕 ⬆️\n2. 選擇「加入主畫面」\n3. 從桌面的 APP 圖示重新開啟本程式\n4. 再次點擊一鍵開啟系統推播即可！")} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}
              >
                <HelpCircle size={14} style={{ marginRight: '0.3rem' }} /> iPhone 點擊失敗？
              </button>
              <button className={styles.onboardingSkipBtn} onClick={skipOnboarding} style={{ marginTop: '0.5rem' }}>
                先不要，跳過
              </button>
            </div>
          </div>
        </div>
      )}

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
                <span className={styles.timestamp}>{formatMessageTime(msg.timestamp)}</span>
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
