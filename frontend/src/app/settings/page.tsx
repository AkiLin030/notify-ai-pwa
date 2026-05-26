"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import styles from "./settings.module.css";
import { Bell, Clock, Settings, MessageSquare, VolumeX, ListTodo, ArrowLeft, Trash2, Moon, Sun, Palette, LogOut } from "lucide-react";

type Schedule = {
  frequency: "minute" | "hour" | "day" | "week" | "month" | "once";
  time: string;
};

type SettingsType = {
  personalitySelect: string;
  personalityCustom: string;
  task: string;
  schedules: Schedule[];
  quietHoursEnabled: boolean;
  quietHours: { start: string; end: string };
  channels: { email: boolean; discord: boolean; webpush: boolean };
  discordWebhook: string;
  webpushSubscription?: any;
};

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

const TASK_PRESETS = [
  { label: "喝水", prompt: "該提醒用戶喝水了，請用語氣嚴厲的方式告訴他多喝水對身體好" },
  { label: "運動", prompt: "該提醒用戶去運動了，用充滿活力的語氣鼓勵他" },
  { label: "讀書", prompt: "提醒用戶該讀書/進修了，用稍微督促的口吻" },
  { label: "吃藥", prompt: "溫柔地提醒用戶該吃藥了，健康最重要" },
  { label: "睡覺", prompt: "提醒用戶該睡覺了，明天才有精神" },
];

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<SettingsType>({
    personalitySelect: "custom",
    personalityCustom: "",
    task: "",
    schedules: [{ frequency: "day", time: "09:00" }],
    quietHoursEnabled: true,
    quietHours: { start: "22:00", end: "07:00" },
    channels: { email: true, discord: false, webpush: false },
    discordWebhook: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Load and apply theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("notify_ui_theme") as "dark" | "light";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("notify_ui_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  };

  useEffect(() => {
    if (user && process.env.NEXT_PUBLIC_API_URL) {
      fetch(process.env.NEXT_PUBLIC_API_URL, {
        headers: { "Authorization": `Bearer ${user.email}` }
      })
      .then(res => res.json())
      .then(data => {
        // If data contains task, it means settings exist
        if (data.task !== undefined) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(console.error);
    }
  }, [user]);

  const validate = () => {
    if (settings.personalitySelect === "custom" && !settings.personalityCustom.trim()) {
      return "請填寫自訂個性。";
    }
    if (!settings.task.trim()) {
      return "請填寫要提醒的事項。";
    }
    if (settings.schedules.length === 0) {
      return "請至少設定一個提醒時間。";
    }
    for (const s of settings.schedules) {
      if (!s.time) return "請確認所有排程時間皆已填寫。";
    }
    if (settings.channels.discord && !settings.discordWebhook.trim()) {
      return "已勾選 Discord 通知，請填寫 Webhook URL。";
    }
    return "";
  };

  const handleWebPushToggle = async (checked: boolean) => {
    if (!checked) {
      setSettings({ ...settings, channels: { ...settings.channels, webpush: false }});
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("此瀏覽器不支援 Web Push。");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("您拒絕了通知權限。");
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "")
      });

      setSettings({
        ...settings,
        channels: { ...settings.channels, webpush: true },
        webpushSubscription: subscription
      });
      alert("成功啟用 Web Push！");
    } catch (err) {
      console.error("Web Push Error", err);
      alert("訂閱 Web Push 失敗");
    }
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setIsSaving(true);

    try {
      if (!process.env.NEXT_PUBLIC_API_URL) throw new Error("API URL is not defined");
      const response = await fetch(process.env.NEXT_PUBLIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.email}`
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) throw new Error("儲存至雲端失敗，請稍後再試");
      
      alert("設定已儲存！");
      router.push("/dashboard"); // Go back to chat interface
    } catch (err: any) {
      setError(err.message || "發生未知錯誤");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !user) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <button className={styles.backButton} onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={20} />
            <span>返回對話</span>
          </button>
        </div>
        <div className={styles.brand} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            {user?.image && <img src={user.image} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
            <span style={{ fontSize: '0.9rem' }}>{user?.email}</span>
          </div>
          <button 
            onClick={() => {
              logout();
              router.push("/");
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            <LogOut size={16} /> 登出
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>設定中心</h1>
          <p className={styles.pageSubtitle}>自訂你的 AI 提醒體驗</p>
        </div>

        {error && <div className={styles.errorText} style={{fontSize: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "rgba(255, 77, 79, 0.1)", borderRadius: "0.5rem"}}>{error}</div>}

        <div className={styles.grid}>
          {/* Section: Appearance */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <Palette size={20} className="text-gradient" />
                <h3>外觀主題</h3>
              </div>
              <div style={{display: "flex", alignItems: "center", gap: "0.5rem"}}>
                <Sun size={18} color={theme === "light" ? "var(--warning)" : "var(--text-secondary)"} />
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={theme === "dark"}
                    onChange={toggleTheme}
                  />
                  <span className={styles.slider}></span>
                </label>
                <Moon size={18} color={theme === "dark" ? "var(--accent-primary)" : "var(--text-secondary)"} />
              </div>
            </div>
          </section>
          {/* Section: Reminder Task */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <ListTodo size={20} className="text-gradient" />
                <h3>提醒事項</h3>
              </div>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>你要 AI 提醒你做什麼？</p>
              <div className={styles.inputGroup}>
                <textarea 
                  className={styles.textarea} 
                  placeholder="例如：該提醒用戶喝水了..."
                  value={settings.task}
                  onChange={(e) => setSettings({ ...settings, task: e.target.value })}
                />
              </div>
              <div className={styles.presets}>
                {TASK_PRESETS.map((preset) => {
                  const isActive = settings.task.includes(preset.prompt);
                  return (
                    <button 
                      key={preset.label} 
                      className={`${styles.presetChip} ${isActive ? styles.active : ""}`}
                      onClick={() => {
                        let newText = settings.task;
                        if (isActive) {
                          // Remove the prompt
                          newText = newText.replace(preset.prompt, "").trim();
                          // Clean up extra newlines
                          newText = newText.replace(/\n{2,}/g, '\n');
                        } else {
                          // Append the prompt
                          newText = newText.trim() ? newText + "\n" + preset.prompt : preset.prompt;
                        }
                        setSettings({ ...settings, task: newText });
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section: Personality */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <MessageSquare size={20} className="text-gradient" />
                <h3>AI 個性</h3>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.inputGroup}>
                <label>請描述你想要的 AI 個性</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="ex. 有點傲嬌但其實很關心人的管家"
                  value={settings.personalityCustom}
                  onChange={(e) => setSettings({ ...settings, personalityCustom: e.target.value })}
                />
              </div>
              
              <div className={styles.presets}>
                {[
                  { id: "tsundere", label: "傲嬌", prompt: "用語氣傲嬌的方式" },
                  { id: "gentle", label: "溫柔", prompt: "用語氣極度溫柔、充滿關愛的方式" },
                  { id: "strict", label: "嚴厲", prompt: "用非常嚴厲、像教官一樣的方式" },
                  { id: "minimalist", label: "極簡", prompt: "用字精簡、不帶感情、直指重點的方式" }
                ].map((p) => {
                  const isActive = settings.personalityCustom.includes(p.prompt);
                  return (
                    <button
                      key={p.id}
                      className={`${styles.presetChip} ${isActive ? styles.active : ""}`}
                      onClick={() => {
                        let newText = settings.personalityCustom;
                        if (isActive) {
                          newText = newText.replace(p.prompt, "").trim();
                          newText = newText.replace(/\n{2,}/g, '\n');
                        } else {
                          newText = newText.trim() ? newText + "\n" + p.prompt : p.prompt;
                        }
                        setSettings({ ...settings, personalityCustom: newText });
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section: Schedule */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <Clock size={20} className="text-gradient" />
                <h3>提醒時間</h3>
              </div>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>設定發送提醒的頻率與時間。</p>
              
              {settings.schedules.map((schedule, idx) => (
                <div key={idx} className={styles.flexRow}>
                  <div className={styles.inputGroup} style={{marginBottom: 0}}>
                    <label>頻率</label>
                    <select 
                      className={styles.select}
                      value={schedule.frequency}
                      onChange={(e) => {
                        const newSchedules = [...settings.schedules];
                        newSchedules[idx].frequency = e.target.value as any;
                        setSettings({ ...settings, schedules: newSchedules });
                      }}
                    >
                      <option value="minute">每分鐘</option>
                      <option value="hour">每小時</option>
                      <option value="day">每天</option>
                      <option value="week">每週</option>
                      <option value="month">每月</option>
                      <option value="once">單次不重複</option>
                    </select>
                  </div>
                  {schedule.frequency !== "minute" && schedule.frequency !== "hour" && (
                    <div className={styles.inputGroup} style={{marginBottom: 0}}>
                      <label>時間</label>
                      <input 
                        type={schedule.frequency === "once" ? "datetime-local" : "time"} 
                        className={styles.input} 
                        value={schedule.time}
                        onChange={(e) => {
                          const newSchedules = [...settings.schedules];
                          newSchedules[idx].time = e.target.value;
                          setSettings({ ...settings, schedules: newSchedules });
                        }}
                      />
                    </div>
                  )}
                  {settings.schedules.length > 1 && (
                    <button 
                      className={styles.removeBtn}
                      onClick={() => {
                        const newSchedules = settings.schedules.filter((_, i) => i !== idx);
                        setSettings({ ...settings, schedules: newSchedules });
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}

              <Button 
                variant="outline" 
                size="sm" 
                className={styles.addBtn}
                onClick={() => {
                  setSettings({ ...settings, schedules: [...settings.schedules, { frequency: "day", time: "" }]});
                }}
              >
                + 新增時段
              </Button>
            </div>
          </section>

          {/* Section: Quiet Hours */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <VolumeX size={20} className="text-gradient" />
                <h3>禁區時間 (勿擾模式)</h3>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={settings.quietHoursEnabled}
                  onChange={(e) => setSettings({ ...settings, quietHoursEnabled: e.target.checked })}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            
            {settings.quietHoursEnabled && (
              <div className={`${styles.cardBody} animate-fade-in`}>
                <p className={styles.description}>這段時間內將不會發送任何提醒。</p>
                <div className={styles.flexRow} style={{marginBottom: 0}}>
                  <div className={styles.inputGroup}>
                    <label>開始時間</label>
                    <input 
                      type="time" 
                      className={styles.input} 
                      value={settings.quietHours.start}
                      onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, start: e.target.value }})}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>結束時間</label>
                    <input 
                      type="time" 
                      className={styles.input} 
                      value={settings.quietHours.end}
                      onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, end: e.target.value }})}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section: Notification Channels */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.headerTitle}>
                <Settings size={20} className="text-gradient" />
                <h3>通知方式</h3>
              </div>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>選擇你希望接收提醒的額外管道。</p>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={settings.channels.email}
                    onChange={(e) => setSettings({ ...settings, channels: { ...settings.channels, email: e.target.checked }})}
                  />
                  Email
                </label>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={settings.channels.webpush}
                    onChange={(e) => handleWebPushToggle(e.target.checked)}
                  />
                  系統推播 (Web Push)
                </label>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={settings.channels.discord}
                    onChange={(e) => setSettings({ ...settings, channels: { ...settings.channels, discord: e.target.checked }})}
                  />
                  Discord Webhook
                </label>
              </div>

              {settings.channels.discord && (
                <div className={`${styles.inputGroup} animate-fade-in`} style={{ marginTop: '1.5rem' }}>
                  <label>Discord Webhook URL</label>
                  <input 
                    type="url" 
                    className={styles.input} 
                    placeholder="https://discord.com/api/webhooks/..."
                    value={settings.discordWebhook}
                    onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        <div className={styles.actions}>
          <Button size="lg" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "儲存中..." : "儲存並返回"}
          </Button>
        </div>
      </main>
    </div>
  );
}
