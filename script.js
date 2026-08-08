const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMaubla_jbQ-EnJjFOyYQw_e_9FhBaw";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// เช็กรหัสผ่านเข้าสู่ระบบ
async function checkAccess() {
  const user = document.getElementById("username").value.trim();
  const code = document.getElementById("access-code").value.trim();
  const errorMsg = document.getElementById("error-msg");

  if (!user || !code) {
    errorMsg.innerText = "กรุณากรอกข้อมูลให้ครบก่อนน้า";
    errorMsg.style.display = "block";
    return;
  }

  const { data, error } = await _supabase
    .from('user_access_codes')
    .select('*')
    .eq('username', user)
    .eq('access_code', code);

  if (error || !data || data.length === 0) {
    errorMsg.innerText = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องน้า!";
    errorMsg.style.display = "block";
    return;
  }

  // เข้าสู่ระบบสำเร็จ
  document.getElementById("login-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  document.getElementById("user-display-name").innerText = user;
  document.getElementById("watermark").innerText = `${user} - ${new Date().toLocaleTimeString()}`;

  // โหลดรายการไฟล์ PDF ทั้งหมดอัตโนมัติ
  loadFileList();
}

// ฟังก์ชันดึงไฟล์ทั้งหมดจาก Supabase Storage มาสร้างเป็นปุ่มอัตโนมัติ
async function loadFileList() {
  const fileGrid = document.getElementById("file-grid");
  fileGrid.innerHTML = "<p>กำลังโหลดรายการไฟล์...</p>";

  const { data, error } = await _supabase.storage.from('pdf-files').list();

  if (error || !data || data.length === 0) {
    fileGrid.innerHTML = "<p>ยังไม่มีไฟล์ในระบบ (ให้ลากไฟล์ใส่ใน Supabase ได้เลยครับ)</p>";
    return;
  }

  fileGrid.innerHTML = ""; // ล้างข้อความโหลด

  // วนลูปสร้างปุ่มไฟล์
  data.forEach((file) => {
    // ข้ามไฟล์ซ่อน (.emptyFolderPlaceholder)
    if (file.name.startsWith('.')) return;

    // สร้าง URL ตรงสำหรับเปิดไฟล์ PDF
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/pdf-files/${file.name}`;

    const card = document.createElement("div");
    card.className = "file-card";
    card.onclick = () => openPdfViewer(file.name, fileUrl);

    card.innerHTML = `
      <div class="card-icon">📄</div>
      <h3>${file.name.replace('.pdf', '')}</h3>
      <p>ไฟล์ PDF เอกสารเฉลย</p>
      <span class="btn-open">เปิดอ่านเนื้อหา →</span>
    `;
    fileGrid.appendChild(card);
  });
}

// ฟังก์ชันเปิดดูไฟล์ PDF
function openPdfViewer(fileName, fileUrl) {
  document.getElementById("dashboard-box").style.display = "none";
  document.getElementById("content-box").style.display = "block";
  
  document.getElementById("pdf-title").innerText = fileName.replace('.pdf', '');
  // ฝัง PDF ดูบนเว็บ
  document.getElementById("pdf-viewer").src = fileUrl;
}

// กดกลับมาหน้าเลือกไฟล์
function backToDashboard() {
  document.getElementById("content-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  document.getElementById("pdf-viewer").src = ""; // ล้าง PDF
}

// สคริปต์ป้องกันการแคป/ก็อปปี้
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "p" || e.key === "s")) || e.key === "F12") {
    e.preventDefault();
  }
});