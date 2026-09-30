# 看板娘 AI 聊天后端（Cloudflare Worker）

博客是纯静态站，密钥不能放浏览器里，所以聊天请求走这个 Worker 中转：
`浏览器 → Worker（持有 API Key） → 大模型`。访客永远看不到你的 Key。

---

## ✅ 当前部署状态（2026-09-30 已上线）

| 项 | 值 |
|---|---|
| Worker 名称 | `reimu-chat`（账号 `235275909@qq.com's Account`，ID `97196fa6eb0381483f30d7a54b2662b2`） |
| **线上接口地址** | **`https://chat.mikuascendlog.com/chat`** |
| 上游模型 | DeepSeek `deepseek-chat` |
| 密钥存储 | Worker Secret `API_KEY`（不出现在前端和仓库） |
| DNS 托管 | 已从 DNSPod 迁到 **Cloudflare**（NS `crystal/randall.ns.cloudflare.com`，区域 status=active） |
| 博客 DNS 记录 | apex 2 条 A（185.199.108/109.153）+ `www` CNAME → `miku523.github.io`，全部**灰云（仅限 DNS）**，保持直连 GitHub Pages |
| `chat` 子域名 | 橙云（Proxied），由 wrangler 的 `custom_domain` 路由自动创建 |

> ⚠️ **不要用 `reimu-chat.235275909.workers.dev`**：`*.workers.dev` 在国内是 DNS 污染 + SNI 阻断双杀（实测直连超时、真实 Cloudflare IP 被 reset），国内访客完全连不上。必须走自有域名 `chat.mikuascendlog.com`。

### 以后要改代码 / 换模型

```bash
cd D:/hexo_blog/cloudflare
export CLOUDFLARE_API_TOKEN=<新建的 Cloudflare API Token>
export CLOUDFLARE_ACCOUNT_ID=97196fa6eb0381483f30d7a54b2662b2
npx wrangler deploy                       # 改完 worker.js 后重新部署
echo "sk-新key" | npx wrangler secret put API_KEY   # 换密钥
```
普通变量（`API_BASE` / `MODEL` / `RATE_LIMIT` / `DAILY_LIMIT`）改 `wrangler.toml` 的 `[vars]` 后重新 deploy 即可。

> 原网页版部署流程（下方第一~四节）仍然有效，作为备用方案保留。

---

## 一、部署 Worker（约 3 分钟，免费额度足够个人博客）

1. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create** → **Create Worker**
2. 名字随便取，比如 `reimu-chat` → **Deploy**（先部署一个空的）
3. 点 **Edit code**，把本目录 `reimu-chat-worker.js` 的**全部内容**粘贴进去覆盖，再 **Deploy**
4. 回到 Worker 页面 → **Settings → Variables and Secrets**，添加：

   | 变量名 | 类型 | 值 | 说明 |
   |---|---|---|---|
   | `API_KEY` | **Secret（加密）** | `sk-你的key` | 必填 |
   | `API_BASE` | Text | `https://api.deepseek.com/v1` | 可改，见下表 |
   | `MODEL` | Text | `deepseek-chat` | 可改 |
   | `ALLOWED_ORIGINS` | Text | 留空即用默认 | 默认已含 `https://mikuascendlog.com` 和本地调试地址 |
   | `RATE_LIMIT` | Text | `12` | 每 IP 每 10 分钟上限，填 0 关闭 |
   | `DAILY_LIMIT` | Text | `60` | 每 IP 每天上限，填 0 关闭 |

   加完变量后**再 Deploy 一次**，或直接刷新页面等生效。

5. 记下你的 Worker 地址，形如 `https://reimu-chat.<你的子域>.workers.dev`

### 常见服务商参数

| 服务商 | API_BASE | MODEL 示例 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |
| 通义千问（兼容模式） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |

只要服务商兼容 OpenAI 的 `/chat/completions` 协议就能用。

## 二、让博客用上它

1. 打开 `source/js/reimu-chat.js`，把第 22 行左右改成你的地址：

   ```js
   WORKER_URL: 'https://reimu-chat.xxx.workers.dev/chat',
   ```

2. `npm run deploy` 重新部署博客。

临时调试不改文件：在网址后加参数即可，例如
`https://mikuascendlog.com/?reimu_ai=https://reimu-chat.xxx.workers.dev/chat`

## 三、验证

在 Worker 页面用 **Quick Edit → Send** 不好测 POST，直接在博客上点看板娘、
发一句话即可。若报错，看浏览器 Network 里 `/chat` 请求的状态码：

- `403` → 来源不在白名单：把访问用的域名加进 `ALLOWED_ORIGINS`
- `429` → 触发限流（正常保护，等一下再聊）
- `502` → 上游模型报错：多为 `API_KEY` 错、余额不足或 `MODEL` 名写错
- `500 服务端未配置 API_KEY` → 变量名拼错，或没重新 Deploy

## 四、成本与安全

- 每个 IP 有速率与每日上限；上限只在本 Worker 实例内存里计数，是**粗粒度保护**，
  不是精确配额，恶意刷量仍可能消耗额度。若担心，把 `DAILY_LIMIT` 调小，
  或在 Cloudflare 后台给 Worker 配 Rate limiting 规则。
- 密钥以 Secret 形式存储，不会出现在前端或仓库里。
- 灵梦的人设提示词在 Worker 的 `SYSTEM_PROMPT` 里，想改语气直接改那段文字再 Deploy。
