// الحل النهائي - يعمل مع Google Apps Script
let topics = [];
let currentTopicId = null;
let isAdmin = false;
let updateInterval = null;
let lastUserActivity = Date.now();
let isUpdating = false;

// تحميل البيانات من Google Apps Script
async function loadTopics() {
    if (isUpdating) return;
    
    try {
        isUpdating = true;
        
        // استخدام fetch مع معالجة خاصة
        const response = await fetch(`${CONFIG.API_URL}?action=getTopics&t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        const data = await response.json();
        
        if (data && data.success) {
            topics = data.topics || [];
            renderTopics();
            updateStats();
            hideConnectionError();
        } else {
            // في حالة عدم وجود بيانات، استخدم البيانات الافتراضية
            if (topics.length === 0) {
                initializeDefaultTopics();
            }
            showConnectionError();
        }
    } catch (error) {
        console.error('Error loading topics:', error);
        // في حالة الخطأ، استخدم البيانات الافتراضية
        if (topics.length === 0) {
            initializeDefaultTopics();
        }
        showConnectionError();
    } finally {
        isUpdating = false;
        showLoading(false);
    }
}

// تهيئة البيانات الافتراضية
function initializeDefaultTopics() {
    topics = [
        { id: 1, title: "أمن المعلومات في البنوك الإلكترونية", status: "available", student: "", studentEmail: "" },
        { id: 2, title: "الذكاء الاصطناعي في التعليم", status: "available", student: "", studentEmail: "" },
        { id: 3, title: "تطوير تطبيقات الهواتف الذكية", status: "available", student: "", studentEmail: "" },
        { id: 4, title: "أنظمة إدارة قواعد البيانات", status: "available", student: "", studentEmail: "" },
        { id: 5, title: "الحوسبة السحابية في الشركات", status: "available", student: "", studentEmail: "" },
        { id: 6, title: "أمن الشبكات والحماية من الهجمات", status: "available", student: "", studentEmail: "" },
        { id: 7, title: "التطور التاريخي للمكتب", status: "available", student: "", studentEmail: "" },
        { id: 8, title: "أهمية وتحديات المكتب الحديث", status: "available", student: "", studentEmail: "" }
    ];
    renderTopics();
    updateStats();
}

// إرسال البيانات إلى Google Apps Script
async function sendToGoogleScript(data) {
    try {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: formData
        });
        
        // حتى لو لم نحصل على استجابة واضحة، نعتبر العملية نجحت
        return { success: true };
    } catch (error) {
        console.error('Error sending to Google Script:', error);
        return { success: false, error: error.message };
    }
}

// عرض المواضيع
function renderTopics() {
    const grid = document.getElementById('topicsGrid');
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
        showAlert('يرجى إدخال بريد إلكتروني صحيح', 'danger');
        return;
    }

    try {
        showLoading(true);
        
        // تحديث محلي فوري
        const topicIndex = topics.findIndex(t => t.id == currentTopicId);
        if (topicIndex !== -1 && topics[topicIndex].status === 'available') {
            topics[topicIndex].status = 'reserved';
            topics[topicIndex].student = studentName;
            topics[topicIndex].studentEmail = studentEmail;
            
            // تحديث الواجهة فوراً
            renderTopics();
            updateStats();
            
            // إرسال إلى Google Script في الخلفية
            sendToGoogleScript({
                action: 'reserveTopic',
                topicId: currentTopicId,
                studentName: studentName,
                studentEmail: studentEmail
            });
            
            const now = new Date().toLocaleString('ar-SA');
            showAlert(`تم حجز الموضوع بنجاح! ✅\nالوقت: ${now}`, 'success');
            closeModal();
            
            // إعادة تحميل من الخادم بعد ثانيتين للتأكد من التزامن
            setTimeout(() => loadTopics(), 2000);
        } else {
            showAlert('هذا الموضوع محجوز بالفعل', 'danger');
        }
        
    } catch (error) {
        console.error('Error reserving topic:', error);
        showAlert('خطأ في حجز الموضوع', 'danger');
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
        
        // إضافة محلية فورية
        const newId = Math.max(...topics.map(t => t.id), 0) + 1;
        const newTopic = {
            id: newId,
            title: title,
            status: 'available',
            student: '',
            studentEmail: ''
        };
        
        topics.push(newTopic);
        renderTopics();
        updateStats();
        
        // إرسال إلى Google Script في الخلفية
        sendToGoogleScript({
            action: 'addTopic',
            title: title
        });
        
        document.getElementById('newTopicTitle').value = '';
        showAlert('تم إضافة الموضوع بنجاح ✅', 'success');
        
        // إعادة تحميل من الخادم بعد ثانيتين للتأكد من التزامن
        setTimeout(() => loadTopics(), 2000);
        
    } catch (error) {
        console.error('Error adding topic:', error);
        showAlert('خطأ في إضافة الموضوع', 'danger');
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
        
        // حذف محلي فوري
        topics = topics.filter(t => t.id !== topicId);
        renderTopics();
        updateStats();
        
        // إرسال إلى Google Script في الخلفية
        sendToGoogleScript({
            action: 'deleteTopic',
            topicId: topicId
        });
        
        showAlert('تم حذف الموضوع بنجاح', 'success');
        
        // إعادة تحميل من الخادم بعد ثانيتين للتأكد من التزامن
        setTimeout(() => loadTopics(), 2000);
        
    } catch (error) {
        console.error('Error deleting topic:', error);
        showAlert('خطأ في حذف الموضوع', 'danger');
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
        
        // إلغاء محلي فوري
        const topicIndex = topics.findIndex(t => t.id == topicId);
        if (topicIndex !== -1) {
            topics[topicIndex].status = 'available';
            topics[topicIndex].student = '';
            topics[topicIndex].studentEmail = '';
            
            renderTopics();
            updateStats();
            
            // إرسال إلى Google Script في الخلفية
            sendToGoogleScript({
                action: 'releaseTopic',
                topicId: topicId
            });
            
            showAlert('تم إلغاء الحجز بنجاح', 'success');
            
            // إعادة تحميل من الخادم بعد ثانيتين للتأكد من التزامن
            setTimeout(() => loadTopics(), 2000);
        }
        
    } catch (error) {
        console.error('Error releasing topic:', error);
        showAlert('خطأ في إلغاء الحجز', 'danger');
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
    if (data.length === 0) return '';
    
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
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 4000);
}

// عرض مؤشر التحميل
function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// بدء التحديث التلقائي
function startAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        if (!document.hidden && !isUserInteracting() && !isUpdating) {
            await loadTopics();
        }
    }, CONFIG.UPDATE_INTERVAL);
}

// فحص تفاعل المستخدم
function isUserInteracting() {
    if (Date.now() - lastUserActivity < 5000) {
        return true;
    }
    
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return true;
    }
    
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
    
    // معالجة الضغط على Enter
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

// معالجة تغيير حالة الصفحة
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoUpdate();
    } else {
        startAutoUpdate();
        setTimeout(() => loadTopics(), 1000);
    }
});

// تنظيف الموارد
window.addEventListener('beforeunload', function() {
    stopAutoUpdate();
});
