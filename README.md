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
