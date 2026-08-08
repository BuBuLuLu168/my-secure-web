const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMaubla_jbQ-EnJjFOyYQw_e_9FhBaw";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentLoggedInUser = "";

function toggleMenu() {
  const menu = document.getElementById("dropdown-menu");
  menu.classList.toggle("show");
}

window.addEventListener("click", (e) => {
  if (!e.target.matches('.menu-btn')) {
    const menu = document.getElementById("dropdown-menu");
    if (menu && menu.classList.contains("show")) {
      menu.classList.remove("show");
    }
  }
});

function showRules() {
  alert("⚠️ กฎการใช้งานคลังเฉลย:\n1. ห้ามคัดลอก แคปหน้าจอ หรือบันทึกไฟล์\n2. ห้ามนำไปเผยแพร่ต่อโดยไม่ได้รับอนุญาต\n3. สิทธิ์ใช้งานเฉพาะผู้ได้รับรหัสผ่านเท่านั้น");
}

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

  currentLoggedInUser = user;
  errorMsg.style.display = "none";
  document.getElementById("login-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  
  const statusBadge = document.getElementById("status-badge");
  statusBadge.className = "badge-status badge-online";
  statusBadge.innerText = `👤 ${user}`;
  document.getElementById("menu-logout").style.display = "block";
  document.getElementById("user-display-name").innerText = user;

  loadFileList();
}

async function loadFileList() {
  const fileGrid = document.getElementById("file-grid");
  fileGrid.innerHTML = "<p style='text-align:center; color:#9e8a78;'>กำลังโหลดรายการไฟล์...</p>";

  const { data, error } = await _supabase.storage.from('pdf-files').list();

  fileGrid.innerHTML = "";

  if (data && data.length > 0) {
    data.forEach((file) => {
      if (file.name.startsWith('.')) return;

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

  // เพิ่มการ์ด Coming Soon ต่อท้ายรายการเสมอ
  const comingSoonCard = document.createElement("div");
  comingSoonCard.className = "file-card coming-soon-card";
  comingSoonCard.innerHTML = `
    <div class="card-icon">⏳</div>
    <h3>Coming soon...</h3>
    <p>กำลังเตรียมไฟล์เฉลยใหม่ๆ เร็วๆ นี้จ้า</p>
  `;
  fileGrid.appendChild(comingSoonCard);
}

async function openPdfViewer(fileName, fileUrl) {
  document.getElementById("dashboard-box").style.display = "none";
  document.getElementById("content-box").style.display = "block";
  document.getElementById("pdf-title").innerText = fileName.replace('.pdf', '');

  const container = document.getElementById("pdf-container");
  container.innerHTML = "<p style='text-align:center; color:#9e8a78; font-size:18px; padding:20px;'>⏳ กำลังโหลดเอกสาร...</p>";

  try {
    const loadingTask = pdfjsLib.getDocument(fileUrl);
    const pdf = await loadingTask.promise;

    container.innerHTML = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      const scale = 2.5;
      const viewport = page.getViewport({ scale: scale });

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

      // --- วาดลายน้ำพาดเอียงฝังลงไปในเนื้อหา Canvas ---
      const watermarkText = `${currentLoggedInUser} - ${new Date().toLocaleDateString('th-TH')}`;
      context.save();
      context.font = "bold 32px 'Itim', sans-serif";
      context.fillStyle = "rgba(180, 140, 110, 0.22)"; // ลายน้ำสีน้ำตาลอ่อน จางๆ ไม่กวนตา
      context.rotate(-25 * Math.PI / 180);

      for (let y = -canvas.height; y < canvas.height * 2; y += 180) {
        for (let x = -canvas.width; x < canvas.width * 2; x += 320) {
          context.fillText(watermarkText, x, y);
        }
      }
      context.restore();
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

function logout() {
  document.getElementById("dashboard-box").style.display = "none";
  document.getElementById("content-box").style.display = "none";
  document.getElementById("login-box").style.display = "block";
  document.getElementById("menu-logout").style.display = "none";

  const statusBadge = document.getElementById("status-badge");
  statusBadge.className = "badge-status";
  statusBadge.innerText = "🔒 ยังไม่ได้เข้าสู่ระบบ";
  
  document.getElementById("username").value = "";
  document.getElementById("access-code").value = "";
  document.getElementById("pdf-container").innerHTML = "";
}

// ป้องกันการคลิกขวา / แคปภาพ / คัดลอก
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "p" || e.key === "s")) || e.key === "F12") {
    e.preventDefault();
  }
});