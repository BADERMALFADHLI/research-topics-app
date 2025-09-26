// متغيرات التطبيق العامة
let topics = [];
let currentTopicId = null;
let isAdmin = false;
let updateInterval = null;

// تحميل البيانات من Google Apps Script
async function loadTopics() {
    try {
        showLoading(true);
        const response = await fetch(`${CONFIG.API_URL}?action=getTopics`);
        const data = await response.json();
        
        if (data.success) {
            topics = data.topics;
            renderTopics();
            updateStats();
        } else {
            showAlert('خطأ في تحميل البيانات: ' + (data.error || 'خطأ غير معروف'), 'danger');
        }
    } catch (error) {
        console.error('Error loading topics:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
    } finally {
        showLoading(false);
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
        showAlert(CONFIG.MESSAGES.ERROR_INVALID_DATA, 'danger');
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
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'reserveTopic',
                topicId: currentTopicId,
                studentName: studentName,
                studentEmail: studentEmail
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showAlert(CONFIG.MESSAGES.SUCCESS_RESERVATION, 'success');
            closeModal();
            await loadTopics(); // إعادة تحميل البيانات
        } else {
            showAlert(data.message || CONFIG.MESSAGES.ERROR_ALREADY_RESERVED, 'danger');
        }
    } catch (error) {
        console.error('Error reserving topic:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
    } finally {
        showLoading(false);
    }
}

// تسجيل دخول الإدارة
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    try {
        showLoading(true);
        
        const response = await fetch(`${CONFIG.API_URL}?action=checkPassword&password=${encodeURIComponent(password)}`);
        const data = await response.json();
        
        if (data.success) {
            isAdmin = true;
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'flex';
            document.getElementById('adminTableContainer').style.display = 'block';
            renderTopics();
            showAlert(CONFIG.MESSAGES.SUCCESS_ADMIN_LOGIN, 'success');
        } else {
            showAlert(CONFIG.MESSAGES.ERROR_WRONG_PASSWORD, 'danger');
        }
    } catch (error) {
        console.error('Error checking password:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
    } finally {
        showLoading(false);
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
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addTopic',
                title: title
            })
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('newTopicTitle').value = '';
            showAlert(CONFIG.MESSAGES.SUCCESS_TOPIC_ADDED, 'success');
            await loadTopics();
        } else {
            showAlert(data.message || 'خطأ في إضافة الموضوع', 'danger');
        }
    } catch (error) {
        console.error('Error adding topic:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
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
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'deleteTopic',
                topicId: topicId
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showAlert(CONFIG.MESSAGES.SUCCESS_TOPIC_DELETED, 'success');
            await loadTopics();
        } else {
            showAlert(data.message || 'خطأ في حذف الموضوع', 'danger');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
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
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'releaseTopic',
                topicId: topicId
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showAlert(CONFIG.MESSAGES.SUCCESS_RESERVATION_CANCELLED, 'success');
            await loadTopics();
        } else {
            showAlert(data.message || 'خطأ في إلغاء الحجز', 'danger');
        }
    } catch (error) {
        console.error('Error releasing topic:', error);
        showAlert(CONFIG.MESSAGES.ERROR_CONNECTION, 'danger');
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

// عرض التنبيهات
function showAlert(message, type) {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(alert);
    
    // إزالة التنبيه تلقائياً بعد 5 ثوان
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// عرض مؤشر التحميل
function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// بدء التحديث التلقائي
function startAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        // تحديث فقط إذا لم يكن المستخدم يكتب أو يتفاعل مع النماذج
        if (!document.hidden && !isUserInteracting()) {
            await loadTopics();
        }
    }, CONFIG.UPDATE_INTERVAL);
}

// فحص ما إذا كان المستخدم يتفاعل مع النماذج
function isUserInteracting() {
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
    
    // فحص إذا كان المستخدم في وضع الإدارة ويكتب
    if (isAdmin) {
        const newTopicInput = document.getElementById('newTopicTitle');
        if (newTopicInput && newTopicInput === activeElement) {
            return true;
        }
    }
    
    return false;
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
        loadTopics(); // تحديث فوري عند العودة للصفحة
    }
});

// تنظيف الموارد عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    stopAutoUpdate();
});


// إضافة معالجات لتحسين تجربة المستخدم
let lastUserActivity = Date.now();

// تتبع نشاط المستخدم
function trackUserActivity() {
    lastUserActivity = Date.now();
}

// إضافة مستمعات للأحداث
document.addEventListener('DOMContentLoaded', function() {
    // تتبع نشاط المستخدم
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, trackUserActivity, true);
    });
});

// تحسين دالة isUserInteracting
function isUserInteractingEnhanced() {
    // إذا كان هناك نشاط حديث (أقل من 3 ثوان)
    if (Date.now() - lastUserActivity < 3000) {
        return true;
    }
    
    return isUserInteracting();
}

// استخدام الدالة المحسنة في التحديث
function startAutoUpdateEnhanced() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        if (!document.hidden && !isUserInteractingEnhanced()) {
            await loadTopics();
        }
    }, CONFIG.UPDATE_INTERVAL);
}
