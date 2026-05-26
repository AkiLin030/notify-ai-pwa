"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";
import { Bot, LogIn, MessageSquare } from "lucide-react";

export default function Home() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className={styles.container}>載入中...</div>;
  }

  return (
    <main className={styles.container}>
      <div className={`${styles.card} animate-fade-in`}>
        <div className={styles.iconWrapper}>
          <Bot size={48} className="text-gradient animate-glow" />
        </div>
        <h1 className={styles.title}>AI 提醒助手</h1>
        <p className={styles.subtitle}>
          傲嬌、溫柔、嚴厲... 讓專屬你的 AI 準時提醒你每一件重要的小事。
        </p>

        <div className={styles.actions}>
          <Button 
            fullWidth 
            size="lg" 
            onClick={() => login("google")}
            icon={<LogIn size={20} />}
          >
            使用 Google 登入
          </Button>
        </div>
      </div>
    </main>
  );
}
