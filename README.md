# Alwakeel-Frontend

واجهة نظام الوكيل (React + TypeScript).

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

إذا لم يظهر المستودع `Team-Solid-Code` في Vercel، استخدم الـ workflow التلقائي:

`.github/workflows/vercel-deploy.yml`

### إعداد الأسرار في GitHub

في **Team-Solid-Code/Alwakeel-Frontend** → **Settings** → **Secrets and variables** → **Actions**:

| Secret | من أين تحصل عليه |
|--------|------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | مشروع solid-system → Settings → General → **Team ID** |
| `VERCEL_PROJECT_ID` | نفس الصفحة → **Project ID** |

أو من الطرفية بعد `cd wakeelfrontend && npx vercel link`:

```bash
cat .vercel/project.json
```

بعد إضافة الأسرار، أي `git push` على `main` ينشر تلقائياً إلى مشروع **solid-system**.
