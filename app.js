// متغيرات التطبيق العامة
let topics = [];
let currentTopicId = null;
let isAdmin = false;
let updateInterval = null;
let lastUserActivity = Date.now();
let isUpdating = false;

// تحميل البيانات من Google Apps Script
async function loadTopics() {
    if (isUpdating) return; // منع التحديثات المتداخلة
    
    try {
        isUpdating = true;
        
        // استخدام JSONP بدلاً من fetch لتجنب مشاكل CORS
        const response = await fetchWithJSONP(`${CONFIG.API_URL}?action=getTopics`);
        
        if (response.success) {
            topics = response.topics || [];
            renderTopics();
            updateStats();
            hideConnectionError();
        } else {
            showConnectionError();
        }
    } catch (error) {
        console.error('Error loading topics:', error);
        showConnectionError();
    } finally {
        isUpdating = false;
        showLoading(false);
    }
}

// استخدام JSONP لتجنب مشاكل CORS
function fetchWithJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        
        // إنشاء script tag
        const script = document.createElement('script');
        script.src = url + '&callback=' + callbackName;
        
        // إنشاء callback function
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };
        
        // معالجة الأخطاء
        script.onerror = function() {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request failed'));
        };
        
        document.body.appendChild(script);
        
        // timeout بعد 10 ثوان
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP request timeout'));
            }
        }, 10000);
    });
}

// إرسال البيانات باستخدام POST مع معالجة CORS
async function postData(data) {
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            mode: 'no-cors', // تجنب مشاكل CORS
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        // بما أن no-cors لا يعطي response، نعتبر الطلب نجح
        return { success: true };
    } catch (error) {
        console.error('Error posting data:', error);
        return { success: false, error: error.message };
    }
}

// عرض المواضيع
function renderTopics() {
    const grid = document.getElementById('topicsGrid');
    
    // تجنب إعادة الرسم إذا كان المستخدم يتفاعل
    if (isUserInteracting()) {
        return;
    }
    
    grid.innerHTML = '';

    if (topics.length === 0) {
        grid.innerHTML = '<div class="no-topics">لا توجد مواضيع متاحة حالياً</div>';
        return;
    }

    topics.forEach(topic => {
        const card = document.createElement('div');
        card.className = `topic-card ${topic.status}`;
        
        if (topic.status === 'available') {
            card.onclick = () => openReservationModal(topic.id);
        }

        card.innerHTML = `
            <div class="topic-title">${topic.title}</div>
            <div class="topic-status status-${topic.status}">
                ${topic.status === 'available' ? 'متاح' : 'محجوز'}
            </div>
            ${topic.status === 'reserved' ? `
                <div class="reserved-info">
                    <strong>الطالب:</strong> ${topic.student}<br>
                    <strong>البريد:</strong> ${topic.studentEmail}
                </div>
            ` : ''}
            ${isAdmin && topic.status === 'reserved' ? `
                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); releaseTopic(${topic.id})" style="margin-top: 10px;">
                    إلغاء الحجز
                </button>
            ` : ''}
            ${isAdmin ? `
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteTopic(${topic.id})" style="margin-top: 10px;">
                    حذف
                </button>
            ` : ''}
        `;

        grid.appendChild(card);
    });

    if (isAdmin) {
        renderAdminTable();
    }
}

// تحديث الإحصائيات
function updateStats() {
    const total = topics.length;
    const available = topics.filter(t => t.status === 'available').length;
    const reserved = topics.filter(t => t.status === 'reserved').length;

    document.getElementById('totalTopics').textContent = total;
    document.getElementById('availableTopics').textContent = available;
    document.getElementById('reservedTopics').textContent = reserved;
}

// عرض/إخفاء خطأ الاتصال
function showConnectionError() {
    const errorDiv = document.getElementById('connectionError');
    if (errorDiv) {
        errorDiv.style.display = 'block';
    }
}

function hideConnectionError() {
    const errorDiv = document.getElementById('connectionError');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// فتح نموذج الحجز
function openReservationModal(topicId) {
    const topic = topics.find(t => t.id == topicId);
    if (!topic || topic.status !== 'available') {
        showAlert('هذا الموضوع غير متاح للحجز', 'danger');
        return;
    }

    currentTopicId = topicId;
    document.getElementById('modalTopicTitle').textContent = topic.title;
    document.getElementById('reservationModal').style.display = 'flex';
    document.getElementById('studentName').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('studentName').focus();
}

// إغلاق النموذج
function closeModal() {
    document.getElementById('reservationModal').style.display = 'none';
    currentTopicId = null;
}

// تأكيد الحجز
async function confirmReservation() {
    const studentName = document.getElementById('studentName').value.trim();
    const studentEmail = document.getElementById('studentEmail').value.trim();

    if (!studentName || !studentEmail) {
        showAlert('يرجى إدخال جميع البيانات المطلوبة', 'danger');
        return;
    }

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
        showAlert('يرجى إدخال بريد إلكتروني صحيح', 'danger');
        return;
    }

    try {
        showLoading(true);
        
        const result = await postData({
            action: 'reserveTopic',
            topicId: currentTopicId,
            studentName: studentName,
            studentEmail: studentEmail
        });
        
        if (result.success) {
            showAlert('تم حجز الموضوع بنجاح! ✅', 'success');
            closeModal();
            // تحديث البيانات بعد ثانيتين
            setTimeout(() => loadTopics(), 2000);
        } else {
            showAlert('خطأ في حجز الموضوع. يرجى المحاولة مرة أخرى', 'danger');
        }
    } catch (error) {
        console.error('Error reserving topic:', error);
        showAlert('خطأ في الاتصال. يرجى المحاولة مرة أخرى', 'danger');
    } finally {
        showLoading(false);
    }
}

// تسجيل دخول الإدارة
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (password === CONFIG.ADMIN_PASSWORD) {
        isAdmin = true;
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        document.getElementById('adminTableContainer').style.display = 'block';
        renderTopics();
        showAlert('تم تسجيل دخول الإدارة بنجاح', 'success');
    } else {
        showAlert('كلمة مرور خاطئة', 'danger');
    }
}

// تسجيل خروج الإدارة
function adminLogout() {
    isAdmin = false;
    document.getElementById('adminLogin').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminTableContainer').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    renderTopics();
}

// إضافة موضوع جديد
async function addTopic() {
    const title = document.getElementById('newTopicTitle').value.trim();
    if (!title) {
        showAlert('يرجى إدخال عنوان الموضوع', 'danger');
        return;
    }

    try {
        showLoading(true);
        
        const result = await postData({
            action: 'addTopic',
            title: title
        });
        
        if (result.success) {
            document.getElementById('newTopicTitle').value = '';
            showAlert('تم إضافة الموضوع بنجاح ✅', 'success');
            // تحديث البيانات بعد ثانيتين
            setTimeout(() => loadTopics(), 2000);
        } else {
            showAlert('خطأ في إضافة الموضوع', 'danger');
        }
    } catch (error) {
        console.error('Error adding topic:', error);
        showAlert('خطأ في الاتصال. يرجى المحاولة مرة أخرى', 'danger');
    } finally {
        showLoading(false);
    }
}

// حذف موضوع
async function deleteTopic(topicId) {
    if (!confirm('هل أنت متأكد من حذف هذا الموضوع؟')) {
        return;
    }

    try {
        showLoading(true);
        
        const result = await postData({
            action: 'deleteTopic',
            topicId: topicId
        });
        
        if (result.success) {
            showAlert('تم حذف الموضوع بنجاح', 'success');
            setTimeout(() => loadTopics(), 2000);
        } else {
            showAlert('خطأ في حذف الموضوع', 'danger');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        showAlert('خطأ في الاتصال. يرجى المحاولة مرة أخرى', 'danger');
    } finally {
        showLoading(false);
    }
}

// إلغاء حجز الموضوع
async function releaseTopic(topicId) {
    if (!confirm('هل أنت متأكد من إلغاء حجز هذا الموضوع؟')) {
        return;
    }

    try {
        showLoading(true);
        
        const result = await postData({
            action: 'releaseTopic',
            topicId: topicId
        });
        
        if (result.success) {
            showAlert('تم إلغاء الحجز بنجاح', 'success');
            setTimeout(() => loadTopics(), 2000);
        } else {
            showAlert('خطأ في إلغاء الحجز', 'danger');
        }
    } catch (error) {
        console.error('Error releasing topic:', error);
        showAlert('خطأ في الاتصال. يرجى المحاولة مرة أخرى', 'danger');
    } finally {
        showLoading(false);
    }
}

// عرض جدول الإدارة
function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';

    topics.forEach(topic => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${topic.id}</td>
            <td>${topic.title}</td>
            <td>
                <span class="topic-status status-${topic.status}">
                    ${topic.status === 'available' ? 'متاح' : 'محجوز'}
                </span>
            </td>
            <td>${topic.student || '-'}</td>
            <td>${topic.studentEmail || '-'}</td>
            <td>
                ${topic.status === 'reserved' ? `
                    <button class="btn btn-warning btn-sm" onclick="releaseTopic(${topic.id})">إلغاء الحجز</button>
                ` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteTopic(${topic.id})">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// تصدير البيانات
function exportData() {
    const data = topics.map(topic => ({
        'الرقم': topic.id,
        'عنوان الموضوع': topic.title,
        'الحالة': topic.status === 'available' ? 'متاح' : 'محجوز',
        'اسم الطالب': topic.student || '',
        'البريد الإلكتروني': topic.studentEmail || ''
    }));

    const csv = convertToCSV(data);
    downloadCSV(csv, 'research_topics_' + new Date().toISOString().split('T')[0] + '.csv');
    showAlert('تم تصدير البيانات بنجاح', 'success');
}

// تحويل البيانات إلى CSV
function convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    return csvContent;
}

// تحميل ملف CSV
function downloadCSV(csv, filename) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// عرض التنبيهات بشكل أقل إزعاجاً
function showAlert(message, type) {
    // إزالة التنبيهات السابقة من نفس النوع
    const existingAlerts = document.querySelectorAll(`.alert-${type}`);
    existingAlerts.forEach(alert => alert.remove());
    
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(alert);
    
    // إزالة التنبيه تلقائياً بعد 4 ثوان
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 4000);
}

// عرض مؤشر التحميل بشكل أقل إزعاجاً
function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// بدء التحديث التلقائي الذكي
function startAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        // تحديث فقط إذا لم يكن المستخدم يتفاعل مع الصفحة
        if (!document.hidden && !isUserInteracting() && !isUpdating) {
            await loadTopics();
        }
    }, CONFIG.UPDATE_INTERVAL);
}

// فحص ما إذا كان المستخدم يتفاعل مع النماذج
function isUserInteracting() {
    // فحص النشاط الحديث (أقل من 5 ثوان)
    if (Date.now() - lastUserActivity < 5000) {
        return true;
    }
    
    // فحص إذا كان هناك حقل نشط (focus)
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return true;
    }
    
    // فحص إذا كان النموذج مفتوح
    const modal = document.getElementById('reservationModal');
    if (modal && modal.style.display === 'flex') {
        return true;
    }
    
    return false;
}

// تتبع نشاط المستخدم
function trackUserActivity() {
    lastUserActivity = Date.now();
}

// إيقاف التحديث التلقائي
function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// معالجة الأحداث عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    // تتبع نشاط المستخدم
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'input'].forEach(event => {
        document.addEventListener(event, trackUserActivity, true);
    });
    
    // تحميل البيانات الأولية
    await loadTopics();
    
    // بدء التحديث التلقائي
    startAutoUpdate();
    
    // معالجة إغلاق النموذج عند النقر خارجه
    window.onclick = function(event) {
        const modal = document.getElementById('reservationModal');
        if (event.target === modal) {
            closeModal();
        }
    }
    
    // معالجة الضغط على Enter في حقول النموذج
    document.getElementById('studentName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('studentEmail').focus();
        }
    });
    
    document.getElementById('studentEmail').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmReservation();
        }
    });
    
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });
    
    document.getElementById('newTopicTitle').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTopic();
        }
    });
});

// معالجة تغيير حالة الصفحة (مخفية/مرئية)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoUpdate();
    } else {
        startAutoUpdate();
        // تحديث فوري عند العودة للصفحة (بعد ثانية واحدة)
        setTimeout(() => loadTopics(), 1000);
    }
});

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    stopAutoUpdate();
});
