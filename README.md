# Trail Pocket PWA v2.0.0

通用行山地圖 PWA：每次由使用者匯入 GPX／KML，管理多條路線，選擇每條路線需要下載的周邊底圖。

## 現有功能

- 一次或分次匯入多個 GPX／KML；支援 GPX 軌跡、GPX route、KML LineString／MultiGeometry／gx:Track 與座標標記。
- 多條路線獨立保存於 IndexedDB，可命名、切換或刪除。多段軌跡不會被補成直線。
- 每條路線可選周邊 500 m、1 km 或 2 km，逐條下載離線底圖。
- 道路、步道、水道與部分地表資料来自 OpenStreetMap；原始向量資料保存在裝置，沒有依賴網上圖磚。
- 下載後顯示資料日期與容量；可刪除底圖而保留路線。下載失敗會保留舊有完整底圖。
- Service Worker 儲存完整 App 介面；檢查 App 資源與底圖是否真正完成，不以曾經打開畫面當作離線完成。
- GPS 位置、精度範圍、與軌跡的距離、舊位置提示、置中及地圖縮放／拖曳。
- Devils Nose 為可選示範，並非固定唯一可使用地圖。
- 所有程式、字體及圖示均不需要外部 CDN。底圖只在用戶按下載時才會向 Overpass 請求。

## 目前交付狀態

此 ZIP 是可部署程式套件，並非已安裝的 App。現有建站服務初始化一直回傳 HTTP 404，因此尚未有完成部署的網址。未進行真實 iPhone 的安裝、離線重啟、GPS 或公共 Overpass 跨網域下載端到端測試。

核心、資料儲存及 Service Worker 的 12 項自動檢查已通過，包含真實 GPX/KML 一致性、多路線独立保存、刪圖保留路線、跨段不補線、失敗下載不誤報離線可用、子目錄下離線重新開啟等情境。這些檢查不等於 iPhone 實機測試。

## 部署及 iPhone 安裝

這是純靜態 PWA，不需要編譯或後端資料庫。

1. 解壓，把 `index.html`、各 `.mjs`、`style.css`、`sw.js`、`manifest.webmanifest` 及 `assets` 資料夾原樣放到 HTTPS 靜態網站。`tests`、`package.json` 與說明文件無需上傳到正式網站。
2. 如使用 GitHub Pages，將上述檔案放在儲存庫根目錄，選擇由該分支根目錄發佈。所有路徑是相對路徑，支援 `https://帳戶.github.io/儲存庫/` 子目錄。
3. iPhone 用 Safari 開啟已部署網址，按分享 → 加入主畫面。
4. 從主畫面打開 App，匯入 GPX／KML。到「離線下載」選擇範圍並下載。
5. 確認「App 可離線開啟」及所需路線「底圖已下載」，開飛行模式並重新打開 App，確認地圖與路線仍顯示。

直接從 iPhone「檔案」打開 `index.html` 不會安裝 PWA，亦不能可靠使用模組、Service Worker、IndexedDB 或 GPS。

## 離線及下載的實際限制

- 公共 Overpass 服務：主要 `https://overpass.kumi.systems/api/interpreter`，備用 `https://overpass-api.de/api/interpreter`。服務可能繁忙、限流或不支援某個網路環境，下載失敗需重試。不同使用者的網路／瀏覽器仍需實測。
- 逐條下載、一次一項，避免大量預載公共服務。每個範圍約 150 km² 上限，回傳資料最多 32 MB，90 秒整體逾時。超長路線請分段匯入。
- 所下載是地理範圍內的道路／步道／水道等向量資料；沒有衛星照片、等高線、即時路況、即時天氣或封路資料。
- GPX/KML 本身留在本機。下載底圖會把路線附近的矩形地理範圍傳送給 Overpass。GPS 點不會傳送到伺服器。
- GPS 是前景功能，iPhone 熄屏或轉到另一個 App 後可能停止更新。這版沒有背景記錄、偏航通知或逐彎導航。灰色點為過期位置。
- 地圖支援全球 ±85°緯度；跨國際換日線路線需分段。每檔最多 25 MB、100,000 路線座標點。
- 不同手機、Safari 與主畫面 PWA 未必共用資料。清除網站資料、私密瀏覽或空間不足可能造成離線資料消失。持續儲存權限不是永久保留保證，出發前仍要測試並保留原始路線檔。
- 路線距離按座標計算，不是完整來回里程保證；現場路牌及最新公園公告優先。

## 示例的資料差異

Devils Nose GPX 與 KML 均含相同的 299 個軌跡座標，計算約 2.952 km。Walking SA 網頁列出 4.4 km 來回、約 2 小時、Grade 4，兩者不一致，因此保留原始軌跡並提示。原檔只有 19 個路線點有海拔，未產生完整高度圖。The Knob Lookout 是原檔附帶、但不在該軌跡上的標記。

來源：https://www.walkingsa.org.au/walk/find-a-place-to-walk/devils-nose-and-back-hike-para-wirra/

## 開發檢查

以 Node.js 20 或以上執行：

```
npm install
npm test
```

本機查看可在此資料夾執行 `python3 -m http.server 8000`，再用瀏覽器打開 `http://localhost:8000/`。正式 iPhone 使用仍需 HTTPS 網址。

每次更新 App 時，修改 `sw.js` 的版本值及畫面版本文字。新 Service Worker 完成下載後，App 會提示更新。App 更新不刪除 IndexedDB 中的路線／底圖。

## 資料及權利

底圖 © OpenStreetMap contributors，按 ODbL 1.0 使用：https://www.openstreetmap.org/copyright 及 https://opendatacommons.org/licenses/odbl/1-0/。

示例底圖 `assets/devils-base.json` 為 2026-09-03 擷取的原始地理範圍資料，按 ODbL 1.0 提供。GPS 示例來自使用者提供的 Walking SA GPX/KML，原有權利維持不變。
