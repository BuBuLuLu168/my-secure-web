// ===================================================
// ไฟล์: script.js (ระบบล็อกอิน + ดึงไฟล์ + บังคับโหลดไฟล์ใหม่)
// ===================================================

// 1. เชื่อมต่อ Supabase (ใส่ Anon Key ของคุณตรงช่องล่างนี้)
const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_ANON_KEY = "ใส่_ANON_KEY_เดิมของคุณที่นี่"; 
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. ฟังก์ชันแปลง URL ป้องกันไฟล์เก่าติด Cache
function getFreshUrl(url) {
  if (!url) return '';
  const timestamp = new Date().getTime();
  return url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;
}

// 3. ฟังก์ชันล็อกอินเข้าสู่ระบบ
async function login() {
  const usernameInput = document.getElementById('username')?.value.trim();
  const passwordInput = document.getElementById('password')?.value.trim();
  const errorMsg = document.getElementById('error-msg');

  if (!usernameInput || !passwordInput) {
    if (errorMsg) errorMsg.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน";
    return;
  }

  // ตรวจสอบ Username / Password จากตาราง user_access_codes
  const { data, error } = await supabase
    .from('user_access_codes')
    .select('*')
    .eq('username', usernameInput)
    .eq('access_code', passwordInput)
    .maybeSingle();

  if (error || !data) {
    if (errorMsg) errorMsg.innerText = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    return;
  }

  // ผ่าน -> ปิดหน้าล็อกอิน แล้วเปิดหน้า Dashboard
  const loginBox = document.getElementById('login-box');
  const dashboardBox = document.getElementById('dashboard-box');

  if (loginBox) loginBox.style.display = 'none';
  if (dashboardBox) dashboardBox.style.display = 'block';

  // โหลดรายการไฟล์มาแสดง
  loadFiles();
}

// 4. ฟังก์ชันดึงรายการไฟล์เอกสาร
async function loadFiles() {
  const fileGrid = document.getElementById('file-grid');
  if (!fileGrid) return;

  const { data: files, error } = await supabase.from('files').select('*');

  if (error || !files) {
    fileGrid.innerHTML = "<p>ไม่สามารถโหลดรายการไฟล์ได้</p>";
    return;
  }

  fileGrid.innerHTML = files.map(file => `
    <div class="card" onclick="openPdf('${file.title}', '${file.url}')" style="cursor: pointer;">
      <h3>${file.title}</h3>
      <p>คลิกเพื่ออ่านเฉลย</p>
    </div>
  `).join('');
}

// 5. ฟังก์ชันเปิดดูเอกสาร PDF (บังคับดึงไฟล์สดใหม่เสมอ)
function openPdf(title, rawPdfUrl) {
  const pdfTitle = document.getElementById('pdf-title');
  const pdfContainer = document.getElementById('pdf-container');
  const dashboardBox = document.getElementById('dashboard-box');
  const contentBox = document.getElementById('content-box');

  if (pdfTitle) pdfTitle.innerText = title;

  const freshUrl = getFreshUrl(rawPdfUrl);

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

  if (dashboardBox) dashboardBox.style.display = 'none';
  if (contentBox) contentBox.style.display = 'block';
}

// 6. ฟังก์ชันย้อนกลับหน้าหลัก
function backToDashboard() {
  const dashboardBox = document.getElementById('dashboard-box');
  const contentBox = document.getElementById('content-box');
  const pdfContainer = document.getElementById('pdf-container');

  if (contentBox) contentBox.style.display = 'none';
  if (dashboardBox) dashboardBox.style.display = 'block';
  if (pdfContainer) pdfContainer.innerHTML = '';
}