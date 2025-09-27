// إعدادات التطبيق
const CONFIG = {
    // رابط Google Apps Script API
    API_URL: 'https://script.google.com/macros/s/AKfycbxdRkDbLwyUYXAOpTdBbvwNjVbndKAhnLdSWZ8Kk8U3TDAuexz-HhYlVccIZmhqWKWg/exec',
    
    // كلمة مرور الإدارة
    ADMIN_PASSWORD: 'admin123',
    
    // إعدادات التحديث
    UPDATE_INTERVAL: 20000, // كل 20 ثانية - أقل إزعاجاً
    
    // إعدادات التطبيق
    APP_TITLE: 'نظام اختيار مواضيع البحث',
    APP_SUBTITLE: 'اختر موضوع بحثك بسهولة ويسر',
    
    // رسائل النظام
    MESSAGES: {
        SUCCESS_RESERVATION: 'تم حجز الموضوع بنجاح!',
        ERROR_ALREADY_RESERVED: 'هذا الموضوع محجوز بالفعل',
        ERROR_INVALID_DATA: 'يرجى إدخال جميع البيانات المطلوبة',
        ERROR_CONNECTION: 'خطأ في الاتصال، يرجى المحاولة مرة أخرى',
        SUCCESS_ADMIN_LOGIN: 'تم تسجيل دخول الإدارة بنجاح',
        ERROR_WRONG_PASSWORD: 'كلمة مرور خاطئة',
        SUCCESS_TOPIC_ADDED: 'تم إضافة الموضوع بنجاح',
        SUCCESS_TOPIC_DELETED: 'تم حذف الموضوع بنجاح',
        SUCCESS_RESERVATION_CANCELLED: 'تم إلغاء حجز الموضوع بنجاح'
    }
};
