const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMaubla_jbQ-EnJjFOyYQw_e_9FhBaw";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ตั้งค่าตัวแปลง PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

  document.getElementById("login-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  document.getElementById("user-display-name").innerText = user;
  document.getElementById("watermark").innerText = `${user} - ${new Date().toLocaleTimeString()}`;

  loadFileList();
}

// ฟังก์ชันดึงไฟล์ทั้งหมดจาก Supabase
async function loadFileList() {
  const fileGrid = document.getElementById("file-grid");
  fileGrid.innerHTML = "<p style='text-align:center; color:#9e8a78;'>กำลังโหลดรายการไฟล์...</p>";

  const { data, error } = await _supabase.storage.from('pdf-files').list();

  if (error || !data || data.length === 0) {
    fileGrid.innerHTML = "<p style='text-align:center; color:#9e8a78; font-size:18px; padding:30px 0;'>⏳ ยังไม่มีรายการไฟล์ในขณะนี้ (Coming Soon...)</p>";
    return;
  }

  fileGrid.innerHTML = "";

  data.forEach((file) => {
    if (file.name.startsWith('.')) return;

    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/pdf-files/${file.name}`;

    const card = document.createElement("div");
    card.className = "file-card";
    card.onclick = () => openPdfViewer(file.name, fileUrl);

    card.innerHTML = `
      <div class="card-icon">📄</div>
      <h3>${file.name.replace('.pdf', '')}</h3>
      <p>ไฟล์ PDF เอกสาร</p>
      <span class="btn-open">เปิดอ่านเนื้อหา →</span>
    `;
    fileGrid.appendChild(card);
  });
}

// ฟังก์ชันแสดง PDF ตรงบนหน้าเว็บ (ไม่เปิดใน Drive)
async function openPdfViewer(fileName, fileUrl) {
  document.getElementById("dashboard-box").style.display = "none";
  document.getElementById("content-box").style.display = "block";
  document.getElementById("pdf-title").innerText = fileName.replace('.pdf', '');

  const container = document.getElementById("pdf-container");
  container.innerHTML = "<p style='text-align:center; color:#9e8a78; font-size:18px; padding:20px;'>⏳ กำลังโหลดเอกสาร...</p>";

  try {
    const loadingTask = pdfjsLib.getDocument(fileUrl);
    const pdf = await loadingTask.promise;

    container.innerHTML = ""; // ล้างข้อความกำลังโหลด

    // วนลูปวาดเนื้อหา PDF ทุกหน้าลงบนหน้าเว็บ
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.marginBottom = "15px";
      canvas.style.borderRadius = "10px";
      canvas.style.boxShadow = "0 4px 10px rgba(0,0,0,0.05)";

      container.appendChild(canvas);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    }
  } catch (error) {
    container.innerHTML = "<p style='color:#e06d53;'>ไม่สามารถเปิดไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง</p>";
  }
}

function backToDashboard() {
  document.getElementById("content-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  document.getElementById("pdf-container").innerHTML = "";
}

// ป้องกันการกดคัดลอก/คลิกขวา
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "p" || e.key === "s")) || e.key === "F12") {
    e.preventDefault();
  }
});