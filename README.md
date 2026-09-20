# Solid-Sys

واجهة نظام الوكيل (React + TypeScript) — Alwakeel Frontend.

## تشغيل المشروع

```bash
cd wakeelfrontend
npm install
npm start
```

يفتح على: http://localhost:3000/wakeel

## ربط الـ API

الفرونت يتصل بـ:

`https://api-solid.execute-iq.com/wakeel/api`

(الوثائق: https://api-solid.execute-iq.com/swagger)

أنشئ `wakeelfrontend/.env.local`:

```
REACT_APP_API_URL=https://api-solid.execute-iq.com/wakeel/api
```

بعد تغيير `.env.local` أعد تشغيل `npm start`.

## النشر على Vercel (GitHub Actions)

`.github/workflows/vercel-deploy.yml`

### إعداد الأسرار في GitHub

في **ahmednabil21/Solid-Sys** → **Settings** → **Secrets and variables** → **Actions**:

| Secret | من أين تحصل عليه |
|--------|------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | مشروع solid-system → Settings → General → **Team ID** |
| `VERCEL_PROJECT_ID` | نفس الصفحة → **Project ID** |

بعد إضافة الأسرار، أي `git push` على `main` ينشر تلقائياً إلى مشروع **solid-system**.

### إعداد Vercel (ربط Git مباشر)

عند ربط `ahmednabil21/Solid-Sys` في Vercel:

- **Root Directory:** اتركه فارغاً (`.`)
- **Install Command / Build Command / Output:** يُؤخذ من `vercel.json` في الجذر (`wakeelfrontend/`)
- في لوحة Vercel: امسح أي Build Command مخصّص مثل `react-scripts build` إن وُجد (Override) حتى لا يتجاوز `vercel.json`
- **Environment Variable:** `REACT_APP_API_URL` = `https://api-solid.execute-iq.com/wakeel/api`
