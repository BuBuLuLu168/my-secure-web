// ===================================================
// ไฟล์: script.js (ระบบดึงเอกสาร + บังคับโหลดไฟล์สดใหม่เสมอ)
// ===================================================

// 1. ฟังก์ชันแปลง URL ให้สดใหม่เสมอ (ป้องกันเบราว์เซอร์ดึงไฟล์เก่าจาก Cache)
function getFreshUrl(url) {
  if (!url) return '';
  const timestamp = new Date().getTime(); // ดึงเวลาปัจจุบันเป็นมิลลิวินาที
  // ถ้ามี query string (?) อยู่แล้วให้ใช้ &t= แต่ถ้าไม่มีให้ใช้ ?t=
  return url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;
}

// 2. ฟังก์ชันเปิดดูเอกสาร PDF
function openPdf(title, rawPdfUrl) {
  const pdfTitle = document.getElementById('pdf-title');
  const pdfContainer = document.getElementById('pdf-container');
  const dashboardBox = document.getElementById('dashboard-box');
  const contentBox = document.getElementById('content-box');

  // ตั้งชื่อหัวข้อเอกสารที่เลือก
  if (pdfTitle) pdfTitle.innerText = title;

  // แปลง URL ให้ติดค่า Cache-Buster ก่อนนำไปแสดงผล
  const freshUrl = getFreshUrl(rawPdfUrl);

  // สั่งแสดงผลเอกสารใน pdf-container
  if (pdfContainer) {
    pdfContainer.innerHTML = `
      <iframe 
        src="${freshUrl}" 
        width="100%" 
        height="650px" 
        style="border: none; border-radius: 8px;"
        allow="autoplay">
      </iframe>
    `;
  }

  // สลับหน้าจอแสดงผล
  if (dashboardBox) dashboardBox.style.display = 'none';
  if (contentBox) contentBox.style.display = 'block';
}

// 3. ฟังก์ชันย้อนกลับไปหน้าหลัก (Dashboard)
function backToDashboard() {
  const dashboardBox = document.getElementById('dashboard-box');
  const contentBox = document.getElementById('content-box');
  const pdfContainer = document.getElementById('pdf-container');

  if (contentBox) contentBox.style.display = 'none';
  if (dashboardBox) dashboardBox.style.display = 'block';
  
  // เคลียร์พื้นที่แสดง PDF ออกเมื่อย้อนกลับ
  if (pdfContainer) pdfContainer.innerHTML = '';
}

// 4. ตัวอย่างฟังก์ชันสร้างการ์ดไฟล์ใน #file-grid (เรียกใช้เมื่อโหลดหน้าเว็บ)
function renderFileCards(fileList) {
  const fileGrid = document.getElementById('file-grid');
  if (!fileGrid) return;

  fileGrid.innerHTML = fileList.map(item => `
    <div class="card" onclick="openPdf('${item.title}', '${item.url}')" style="cursor: pointer;">
      <h3>${item.title}</h3>
      <p>คลิกเพื่ออ่านเฉลย</p>
    </div>
  `).join('');
}