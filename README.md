# Notify AI

可自訂 AI 個性的提醒 PWA。讓提醒不只是一句「記得喝水」，而是用你喜歡的個性和語氣來提醒你。

🔗 線上體驗：https://main.dpl40qw5vd3xt.amplifyapp.com/

## 功能
- **AI 個性**：自訂性格，提醒訊息會用該個性的語氣發送
- **彈性排程**：每分鐘、每小時、每天、每週、每月，或指定日期（不重複）
- **勿擾時段**：設定時間區間，區間內暫停所有提醒
- **多種通知方式**：系統推播（Web Push）、Email、Discord Webhook
- **PWA**：可安裝到手機桌面
  （iPhone 的系統推播有限制，建議改用 Discord 或 Email）

## 技術
- 前端：Next.js、TypeScript、PWA
- 後端：AWS Lambda（邏輯處理）、EventBridge（定時排程）、DynamoDB（資料庫）、SNS（通知發送）
- 部署與維運：AWS S3 + CloudFront、CodePipeline / CodeBuild（CI/CD）、CloudFormation（IaC）、CloudWatch

## 關於這個專案
課堂小組專案，程式開發與部署由我完成。

## 截圖
<img width="1211" height="357" alt="Screenshot_2026-11-04-13-14-38-022_com discord" src="https://github.com/user-attachments/assets/7f26a0f8-82fb-4a1a-bdf4-15456fa72feb" />
<img width="1599" height="868" alt="Snipaste_2026-11-12_17-07-59" src="https://github.com/user-attachments/assets/dd53e3b8-71d1-4b58-928d-21373e5d577b" />

