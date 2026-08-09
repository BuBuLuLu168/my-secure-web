// ==========================================
// My KeySpace - Main Script ( Customer Side )
// ==========================================

const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMaubla_jbQ-EnJjFOyYQw_e_9FhBaw";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ตั้งค่า PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentLoggedInUser = "";

// ------------------------------------------
// 0. ระบบสลับโหมดมืด / โหมดสว่าง (Dark Mode)
// ------------------------------------------

function initTheme() {
  const savedTheme = localStorage.getItem("user_theme");
  const themeBtn = document.getElementById("theme-btn");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (themeBtn) themeBtn.innerText = "☀️ โหมดสว่าง";
  } else {
    document.body.classList.remove("dark-mode");
    if (themeBtn) themeBtn.innerText = "🌙 โหมดมืด";
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  const themeBtn = document.getElementById("theme-btn");

  if (isDark) {
    localStorage.setItem("user_theme", "dark");
    if (themeBtn) themeBtn.innerText = "☀️ โหมดสว่าง";
  } else {
    localStorage.setItem("user_theme", "light");
    if (themeBtn) themeBtn.innerText = "🌙 โหมดมืด";
  }
}

// เรียกทำงานธีมทันทีที่โหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", initTheme);

// ------------------------------------------
// 1. ระบบเมนู & แจ้งเตือน
// ------------------------------------------

function toggleMenu() {
  const menu = document.getElementById("dropdown-menu");
  if (menu) menu.classList.toggle("show");
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

// ------------------------------------------
// 2. ระบบเข้าสู่ระบบ (Case-insensitive)
// ------------------------------------------

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
    .ilike('username', user)
    .eq('access_code', code);

  if (error || !data || data.length === 0) {
    errorMsg.innerText = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องน้า!";
    errorMsg.style.display = "block";
    return;
  }

  currentLoggedInUser = data[0].username;
  errorMsg.style.display = "none";
  document.getElementById("login-box").style.display = "none";
  document.getElementById("dashboard-box").style.display = "block";
  
  const statusBadge = document.getElementById("status-badge");
  statusBadge.className = "badge-status badge-online";
  statusBadge.innerText = `👤 ${currentLoggedInUser}`;
  document.getElementById("menu-logout").style.display = "block";
  document.getElementById("user-display-name").innerText = currentLoggedInUser;

  loadFileList();
}

// ------------------------------------------
// 3. ดึงรายการไฟล์เฉพาะที่มีสิทธิ์
// ------------------------------------------

async function loadFileList() {
  const fileGrid = document.getElementById("file-grid");
  fileGrid.innerHTML = "<p style='text-align:center; color:var(--sub-text); padding:20px;'>⏳ กำลังตรวจสอบสิทธิ์เข้าถึงไฟล์...</p>";

  const { data: userPerms, error: permError } = await _supabase
    .from('user_permissions')
    .select('file_name')
    .ilike('username', currentLoggedInUser);

  fileGrid.innerHTML = "";

  if (permError || !userPerms || userPerms.length === 0) {
    fileGrid.innerHTML = "<p style='text-align:center; color:var(--sub-text); padding:20px;'>🔒 คุณยังไม่มีสิทธิ์เข้าถึงไฟล์เฉลยในขณะนี้ กรุณาติดต่อแอดมินน้า</p>";
    appendComingSoonCard(fileGrid);
    return;
  }

  const allowedFileNames = userPerms.map(p => p.file_name);
  const { data: storageFiles, error: storageError } = await _supabase.storage.from('pdf-files').list();

  if (storageFiles && storageFiles.length > 0) {
    storageFiles.forEach((file) => {
      if (file.name.startsWith('.')) return;

      if (allowedFileNames.includes(file.name)) {
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
      }
    });
  }

  appendComingSoonCard(fileGrid);

  if (document.getElementById("search-input").value) {
    filterFiles();
  }
}

function appendComingSoonCard(container) {
  const comingSoonCard = document.createElement("div");
  comingSoonCard.className = "file-card coming-soon-card";
  comingSoonCard.innerHTML = `
    <div class="card-icon">⏳</div>
    <h3>Coming soon...</h3>
    <p>กำลังเตรียมไฟล์เฉลยใหม่ๆ เร็วๆ นี้จ้า</p>
  `;
  container.appendChild(comingSoonCard);
}

function filterFiles() {
  const searchText = document.getElementById("search-input").value.toLowerCase().trim();
  const cards = document.querySelectorAll(".file-card");

  cards.forEach((card) => {
    if (card.classList.contains("coming-soon-card")) {
      card.style.display = "block";
      return;
    }

    const title = card.querySelector("h3").innerText.toLowerCase();
    if (title.includes(searchText)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// ------------------------------------------
// 4. แสดงผล PDF + ฝังลายน้ำดิจิทัล (ป้องกัน Cache)
// ------------------------------------------

async function openPdfViewer(fileName, fileUrl) {
  document.getElementById("dashboard-box").style.display = "none";
  document.getElementById("content-box").style.display = "block";
  document.getElementById("pdf-title").innerText = fileName.replace('.pdf', '');

  const container = document.getElementById("pdf-container");
  container.innerHTML = "<p style='text-align:center; color:var(--sub-text); font-size:18px; padding:20px;'>⏳ กำลังโหลดเอกสาร...</p>";

  try {
    const freshUrl = fileUrl.includes('?') 
      ? `${fileUrl}&t=${new Date().getTime()}` 
      : `${fileUrl}?t=${new Date().getTime()}`;

    const loadingTask = pdfjsLib.getDocument(freshUrl);
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

      const watermarkText = `${currentLoggedInUser} - ${new Date().toLocaleDateString('th-TH')}`;
      context.save();
      context.font = "bold 32px 'Itim', sans-serif";
      context.fillStyle = "rgba(226, 169, 155, 0.22)";
      context.rotate(-25 * Math.PI / 180);

      for (let y = -canvas.height; y < canvas.height * 2; y += 180) {
        for (let x = -canvas.width; x < canvas.width * 2; x += 320) {
          context.fillText(watermarkText, x, y);
        }
      }
      context.restore();
    }
  } catch (error) {
    container.innerHTML = "<p style='color:#d9534f;'>ไม่สามารถเปิดไฟล์นี้ได้ กรุณาลองใหม่อีกครั้ง</p>";
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
  document.getElementById("search-input").value = "";
  document.getElementById("pdf-container").innerHTML = "";
}

// ------------------------------------------
// 5. ระบบ Pull-to-Refresh มือถือ
// ------------------------------------------

let touchStartY = 0;
let touchEndY = 0;

window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  touchEndY = e.changedTouches[0].clientY;
  
  const isDashboardVisible = document.getElementById("dashboard-box").style.display !== "none";
  const isAtTop = window.scrollY === 0;

  if (isDashboardVisible && isAtTop && (touchEndY - touchStartY > 100)) {
    loadFileList();
  }
}, { passive: true });

// ------------------------------------------
// 6. ระบบป้องกันการคัดลอก / ป้องกันแคปหน้าจอ
// ------------------------------------------

document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen" || (e.ctrlKey && (e.key === "p" || e.key === "s")) || e.key === "F12") {
    e.preventDefault();
  }
});