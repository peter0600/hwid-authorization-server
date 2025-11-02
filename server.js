const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;  // Render.com 會自動設置 PORT

// 中間件
app.use(cors());  // 允許跨域請求
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 數據文件路徑
const DATA_DIR = path.join(__dirname, 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'hwid_requests.txt');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants.json');
const AUTH_FILE = path.join(DATA_DIR, 'authorized_hwids.txt');

// 確保數據目錄存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化文件
function initFiles() {
    if (!fs.existsSync(TENANTS_FILE)) {
        fs.writeFileSync(TENANTS_FILE, JSON.stringify({}, null, 2));
    }
    if (!fs.existsSync(AUTH_FILE)) {
        fs.writeFileSync(AUTH_FILE, '');
    }
    if (!fs.existsSync(REQUESTS_FILE)) {
        fs.writeFileSync(REQUESTS_FILE, '');
    }
}

initFiles();

// ==================== 租戶管理 ====================

// 載入租戶資料
function loadTenants() {
    try {
        const data = fs.readFileSync(TENANTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

// 保存租戶資料
function saveTenants(tenants) {
    fs.writeFileSync(TENANTS_FILE, JSON.stringify(tenants, null, 2));
}

// ==================== API 端點 ====================

// 健康檢查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 接收 HWID 授權請求（客戶端發送）
app.post('/api/request', (req, res) => {
    try {
        const { hwid, hostname, os } = req.body;
        
        if (!hwid) {
            return res.status(400).json({ 
                success: false, 
                message: 'HWID 不能為空' 
            });
        }
        
        // 檢查是否已授權
        const tenants = loadTenants();
        let isAuthorized = false;
        let existingTenant = null;
        
        for (const tenantId in tenants) {
            if (tenants[tenantId].hwid === hwid && tenants[tenantId].status === '啟用') {
                isAuthorized = true;
                existingTenant = tenants[tenantId];
                break;
            }
        }
        
        if (isAuthorized) {
            return res.json({ 
                success: true, 
                message: '已授權', 
                authorized: true 
            });
        }
        
        // 檢查是否已被拒絕（在請求列表中查找）
        try {
            const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const parts = line.split('|');
                if (parts[0] === hwid && parts[4] && parts[4].trim() === '已拒絕') {
                    return res.json({
                        success: true,
                        message: '此 HWID 已被拒絕',
                        authorized: false,
                        denied: true
                    });
                }
            }
        } catch (e) {
            // 忽略讀取錯誤
        }
        
        // 檢查是否已有待審核的請求（避免重複）
        let alreadyRequested = false;
        try {
            const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
            if (data.includes(hwid + '|')) {
                alreadyRequested = true;
            }
        } catch (e) {
            // 忽略
        }
        
        if (!alreadyRequested) {
            // 保存請求到文件
            const requestData = `${hwid}|${hostname || 'Unknown'}|${os || 'Unknown'}|${new Date().toISOString()}|待審核\n`;
            fs.appendFileSync(REQUESTS_FILE, requestData);
            // 已收到 HWID 請求
        }
        
        res.json({ 
            success: true, 
            message: '請求已收到，等待審核',
            authorized: false
        });
        
    } catch (error) {
        // 處理請求錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 檢查 HWID 是否授權（客戶端檢查）
app.get('/api/check', (req, res) => {
    try {
        const { hwid } = req.query;
        
        if (!hwid) {
            return res.status(400).json({ 
                success: false, 
                message: 'HWID 不能為空' 
            });
        }
        
        const tenants = loadTenants();
        let isAuthorized = false;
        
        for (const tenantId in tenants) {
            if (tenants[tenantId].hwid === hwid && tenants[tenantId].status === '啟用') {
                isAuthorized = true;
                break;
            }
        }
        
        res.json({
            success: true,
            hwid: hwid,
            authorized: isAuthorized
        });
        
    } catch (error) {
        // 檢查錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 獲取所有請求（管理端使用）
app.get('/api/requests', (req, res) => {
    try {
        const requests = [];
        const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
        const lines = data.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 4) {
                requests.push({
                    hwid: parts[0],
                    hostname: parts[1],
                    os: parts[2],
                    time: parts[3],
                    status: parts[4] || '待審核'
                });
            }
        }
        
        res.json({ success: true, requests: requests });
        
    } catch (error) {
        // 讀取請求錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 獲取所有租戶（管理端使用）
app.get('/api/tenants', (req, res) => {
    try {
        const tenants = loadTenants();
        const tenantList = Object.keys(tenants).map(id => ({
            tenantId: id,
            ...tenants[id]
        }));
        
        res.json({ success: true, tenants: tenantList });
        
    } catch (error) {
        // 讀取租戶錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 允許 HWID（管理端使用）
app.post('/api/approve', (req, res) => {
    try {
        const { hwid, tenantName, jarUrl, expiryDate } = req.body;
        
        if (!hwid) {
            return res.status(400).json({ 
                success: false, 
                message: 'HWID 不能為空' 
            });
        }
        
        const tenants = loadTenants();
        const tenantId = `TENANT_${Date.now()}`;
        
        // 檢查是否已存在
        let existingTenantId = null;
        for (const id in tenants) {
            if (tenants[id].hwid === hwid) {
                existingTenantId = id;
                break;
            }
        }
        
        const tenantData = {
            tenantName: tenantName || '自動添加',
            hwid: hwid,
            jarUrl: jarUrl || '',
            usageCount: 0,
            maxUsage: 0,  // 預設無限制
            status: '啟用',
            lastAccessTime: Date.now(),
            expiryDate: expiryDate || 0  // 0 表示永不過期
        };
        
        if (existingTenantId) {
            tenants[existingTenantId] = { ...tenants[existingTenantId], ...tenantData, status: '啟用' };
        } else {
            tenants[tenantId] = tenantData;
        }
        
        saveTenants(tenants);
        
        // 更新請求狀態
        updateRequestStatus(hwid, '已允許');
        
        res.json({ 
            success: true, 
            message: '授權成功',
            tenantId: existingTenantId || tenantId
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 拒絕 HWID（管理端使用）
app.post('/api/deny', (req, res) => {
    try {
        const { hwid } = req.body;
        
        if (!hwid) {
            return res.status(400).json({ 
                success: false, 
                message: 'HWID 不能為空' 
            });
        }
        
        // 更新請求狀態
        updateRequestStatus(hwid, '已拒絕');
        
        // 重要：從租戶列表中移除或停用該 HWID
        const tenants = loadTenants();
        let removed = false;
        
        for (const tenantId in tenants) {
            if (tenants[tenantId].hwid === hwid) {
                // 方法1：完全刪除租戶
                delete tenants[tenantId];
                removed = true;
                // 方法2：或將狀態改為停用（如果想保留記錄）
                // tenants[tenantId].status = '停用';
                break;
            }
        }
        
        if (removed || Object.keys(tenants).length !== Object.keys(loadTenants()).length) {
            saveTenants(tenants);
            // 已拒絕並移除 HWID
        } else {
            // 已拒絕 HWID (未找到對應租戶)
        }
        
        res.json({ 
            success: true, 
            message: '已拒絕並移除授權' 
        });
        
    } catch (error) {
        // 拒絕錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 更新請求狀態
function updateRequestStatus(hwid, status) {
    try {
        const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
        const lines = data.split('\n');
        const updatedLines = lines.map(line => {
            if (line.startsWith(hwid + '|')) {
                const parts = line.split('|');
                if (parts.length >= 4) {
                    return `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}|${status}`;
                }
            }
            return line;
        });
        fs.writeFileSync(REQUESTS_FILE, updatedLines.join('\n'));
    } catch (error) {
        // 更新請求狀態錯誤
    }
}

// 同步租戶數據（管理端保存時調用）
app.post('/api/sync/tenants', (req, res) => {
    try {
        const { tenants } = req.body;
        
        if (!tenants || typeof tenants !== 'object') {
            return res.status(400).json({ 
                success: false, 
                message: '無效的租戶數據' 
            });
        }
        
        saveTenants(tenants);
        
        res.json({ 
            success: true, 
            message: '同步成功' 
        });
        
    } catch (error) {
        // 同步錯誤
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 獲取 JAR URL（客戶端使用）
app.get('/api/getjar', (req, res) => {
    try {
        const { hwid } = req.query;
        
        if (!hwid) {
            return res.status(400).json({ 
                success: false, 
                message: 'HWID 不能為空' 
            });
        }
        
        const tenants = loadTenants();
        let tenant = null;
        
        for (const tenantId in tenants) {
            if (tenants[tenantId].hwid === hwid && tenants[tenantId].status === '啟用') {
                tenant = tenants[tenantId];
                break;
            }
        }
        
        if (tenant) {
            // 檢查是否過期
            const now = Date.now();
            if (tenant.expiryDate && tenant.expiryDate > 0 && now > tenant.expiryDate) {
                return res.status(403).json({
                    success: false,
                    status: 'expired',
                    message: '授權已過期'
                });
            }
            
            res.json({
                success: true,
                jarUrl: tenant.jarUrl || '',
                status: 'active'
            });
        } else {
            res.status(403).json({
                success: false,
                status: 'invalid'
            });
        }
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 刪除資料庫（危險操作）
app.post('/api/delete_db', (req, res) => {
    try {
        const { dbName } = req.body;
        
        if (!dbName) {
            return res.status(400).json({ 
                success: false, 
                message: '資料庫名稱不能為空' 
            });
        }
        
        // 這裡應該實際連接到 MySQL 並刪除資料庫
        // 由於沒有 MySQL 連接配置，這裡返回成功
        // 實際實現需要在服務器端配置 MySQL 連接
        res.json({ 
            success: true, 
            message: '資料庫刪除請求已接收（需要服務器端配置 MySQL 連接）' 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 啟動服務器
app.listen(PORT, () => {
    // 服務器已啟動
});

