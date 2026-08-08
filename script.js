const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_KEY = "sb_publishable_zMaubla_jbQ-EnJjFOyYQw_e_9FhBaw";

// สร้างตัวเชื่อมต่อ Supabase
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ฟังก์ชันเช็กรหัสผ่านจากฐานข้อมูลจริง
async function checkAccess() {
  const user = document.getElementById("username").value.trim();
  const code = document.getElementById("access-code").value.trim();
  const errorMsg = document.getElementById("error-msg");

  if (!user || !code) {
    errorMsg.innerText = "กรุณากรอกข้อมูลให้ครบถ้วน";
    errorMsg.style.display = "block";
    return;
  }

  // ค้นหาในตาราง user_access_codes ว่ามี username และ access_code ตรงกันไหม
  const { data, error } = await _supabase
    .from('user_access_codes')
    .select('*')
    .eq('username', user)
    .eq('access_code', code);

  if (error) {
    console.error(error);
    errorMsg.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล";
    errorMsg.style.display = "block";
    return;
  }

  // ถ้าเจอข้อมูลตรงกัน ให้เปิดหน้าไฟล์
  if (data && data.length > 0) {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("content-box").style.display = "block";
    
    // แสดงลายน้ำเป็นชื่อผู้ใช้ที่ล็อกอิน
    document.getElementById("watermark").innerText = `${user} - ${new Date().toLocaleTimeString()}`;
  } else {
    errorMsg.innerText = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!";
    errorMsg.style.display = "block";
  }
}

// ---------------- สคริปต์ป้องกันการแคป/ก็อปปี้ ----------------
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
  if (
    e.key === "PrintScreen" || 
    (e.ctrlKey && (e.key === "p" || e.key === "s" || e.key === "u")) ||
    (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
    e.key === "F12"
  ) {
    e.preventDefault();
    alert("ระบบไม่อนุญาตให้บันทึกภาพหรือใช้คำสั่งนี้");
  }
});

window.addEventListener("blur", () => {
  document.body.style.filter = "blur(30px)";
});

window.addEventListener("focus", () => {
  document.body.style.filter = "none";
});