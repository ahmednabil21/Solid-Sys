import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * عند 401/403: لا تحذف التوكن ولا أعد التوجيه لـ /login.
     * يُستخدم مثلاً لـ GET /me/features أثناء إكمال جلسة MainAgent حتى لا تُلغى الجلسة إذا رفض الباكند الطلب.
     */
    skipAuthRedirect?: boolean;
    /** استخدام توكن تطبيق المشترك (subscriberToken) بدلاً من توكن لوحة التحكم */
    useSubscriberAuth?: boolean;
  }
}
