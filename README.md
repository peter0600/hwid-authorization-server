# HWID 授權中間服務器

用於在 Render.com 上部署的 HWID 授權服務器。

## 部署到 Render.com

### 步驟 1: 準備代碼

1. 確保已安裝 Node.js（版本 18+）
2. 在本地測試：
   ```bash
   npm install
   npm start
   ```

### 步驟 2: 創建 GitHub 倉庫

1. 在 GitHub 創建新倉庫（例如：`hwid-authorization-server`）
2. 將此文件夾的所有文件上傳到 GitHub

### 步驟 3: 在 Render.com 部署

1. 登入 Render.com
2. 點擊「New」→「Web Service」
3. 連接你的 GitHub 倉庫
4. 設置：
   - **Name**: `hwid-authorization-server`（或自定義）
   - **Region**: 選擇最靠近你的區域
   - **Branch**: `main`（或你的主分支）
   - **Root Directory**: （留空，因為代碼在根目錄）
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 點擊「Create Web Service」

### 步驟 4: 獲取服務器 URL

部署完成後，Render.com 會提供一個 URL，例如：
```
https://hwid-authorization-server.onrender.com
```

**重要**: 免費方案的服務器會在 15 分鐘無活動後休眠，首次訪問需要等待約 30-50 秒啟動。

### 步驟 5: 配置客戶端和管理端

將服務器 URL 配置到客戶端和管理端代碼中。

## API 端點

### 客戶端使用的端點

- `POST /api/request` - 發送 HWID 授權請求
- `GET /api/check?hwid=xxx` - 檢查 HWID 是否授權
- `GET /api/getjar?hwid=xxx` - 獲取 JAR 下載地址

### 管理端使用的端點

- `GET /api/requests` - 獲取所有請求列表
- `GET /api/tenants` - 獲取所有租戶
- `POST /api/approve` - 允許 HWID
- `POST /api/deny` - 拒絕 HWID
- `POST /api/sync/tenants` - 同步租戶數據

### 通用端點

- `GET /health` - 健康檢查

## 注意事項

1. **免費方案限制**：
   - 15 分鐘無活動後休眠
   - 首次訪問需要等待啟動
   - 可以使用外部服務保持活動（如 UptimeRobot）

2. **數據持久化**：
   - Render.com 免費方案的文件系統是臨時的
   - 建議升級到付費方案或使用外部數據庫（如 MongoDB Atlas 免費版）

3. **安全建議**：
   - 考慮添加 API Key 驗證
   - 使用 HTTPS（Render.com 自動提供）

## 測試

部署後，訪問：
```
https://your-app.onrender.com/health
```

應該看到：
```json
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

