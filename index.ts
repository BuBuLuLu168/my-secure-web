import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import jsQR from "https://esm.sh/jsqr@1.4.0";
import jpeg from "https://esm.sh/jpeg-js@0.4.4";
import { PNG } from "https://esm.sh/pngjs@6.0.0";
import { Buffer } from "node:buffer";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const SUPABASE_URL = "https://uosbgylfvenkpesxxrct.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LINE_ACCESS_TOKEN = Deno.env.get("LINE_ACCESS_TOKEN") || "";
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") || "";

const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const DISCORD_CHANNEL_ID = Deno.env.get("DISCORD_CHANNEL_ID") || "";
const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";

const FILE_1 = "Ans_Smart Digital and AI Skills (5 Tests)";
const FILE_2 = "Ans_Mooc_English_Commu";

function isBusinessHours(): boolean {
  const now = new Date();
  const thaiTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const totalMinutes = thaiTime.getUTCHours() * 60 + thaiTime.getUTCMinutes();
  return totalMinutes >= (9 * 60 + 30) && totalMinutes < (22 * 60);
}

function cleanName(str: string): string {
  if (!str) return "";
  return str.replace(/[^\w\d\u0E00-\u0E7F]/g, "").toLowerCase();
}

async function verifyDiscordSignature(rawBody: string, signature: string | null, timestamp: string | null): Promise<boolean> {
  if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) return false;
  try {
    const hexToUint8Array = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const key = await crypto.subtle.importKey(
      "raw",
      hexToUint8Array(DISCORD_PUBLIC_KEY),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const encoder = new TextEncoder();
    const data = encoder.encode(timestamp + rawBody);
    return await crypto.subtle.verify("Ed25519", key, hexToUint8Array(signature), data);
  } catch { return false; }
}

async function verifyLineSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !LINE_CHANNEL_SECRET) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(LINE_CHANNEL_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    return btoa(String.fromCharCode(...new Uint8Array(sigBuffer))) === signature;
  } catch { return false; }
}

async function getLineProfile(userId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    });
    if (res.ok) {
      const profile = await res.json();
      return profile.displayName || "คุณลูกค้า";
    }
  } catch (err) { console.error("Profile Error:", err); }
  return "คุณลูกค้า";
}

async function getOrCreateUserAccess(lineUserId: string, displayName: string) {
  const safeName = displayName?.trim() || "คุณลูกค้า";

  const { data: byId } = await supabase.from("user_access_codes").select("*").eq("line_user_id", lineUserId).limit(1);
  if (byId && byId.length > 0) {
    let code = byId[0].access_code || Math.floor(1000 + Math.random() * 9000).toString();
    if (!byId[0].access_code) {
      await supabase.from("user_access_codes").update({ access_code: String(code) }).eq("line_user_id", lineUserId);
    }
    return { username: byId[0].username || safeName, accessCode: String(code), isExisting: true };
  }

  const { data: byName } = await supabase.from("user_access_codes").select("*").eq("username", safeName).limit(1);
  if (byName && byName.length > 0) {
    let code = byName[0].access_code || Math.floor(1000 + Math.random() * 9000).toString();
    await supabase.from("user_access_codes").update({ line_user_id: lineUserId, access_code: String(code) }).eq("username", safeName);
    return { username: byName[0].username, accessCode: String(code), isExisting: true };
  }

  const { data: allUsers } = await supabase.from("user_access_codes").select("*");
  const targetClean = cleanName(safeName);
  if (allUsers && targetClean) {
    const match = allUsers.find(u => cleanName(u.username || "") === targetClean);
    if (match) {
      let code = match.access_code || Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from("user_access_codes").update({ line_user_id: lineUserId, access_code: String(code) }).eq("username", match.username);
      return { username: match.username, accessCode: String(code), isExisting: true };
    }
  }

  const newCode = Math.floor(1000 + Math.random() * 9000).toString();
  await supabase.from("user_access_codes").insert([{ username: safeName, access_code: newCode, line_user_id: lineUserId, Details: "LINE Registered" }]);
  return { username: safeName, accessCode: newCode, isExisting: false };
}

async function scanQRCodeFromBuffer(imageBuffer: Uint8Array): Promise<string | null> {
  try {
    let width = 0, height = 0, rgbaData: Uint8Array | null = null;
    try {
      const png = PNG.sync.read(Buffer.from(imageBuffer));
      width = png.width; height = png.height; rgbaData = new Uint8Array(png.data);
    } catch {
      try {
        const jpg = jpeg.decode(imageBuffer, { useTolerantDecoder: true });
        width = jpg.width; height = jpg.height; rgbaData = jpg.data;
      } catch { return null; }
    }
    if (!rgbaData || !width || !height) return null;

    const clamped = new Uint8ClampedArray(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength);
    let code = jsQR(clamped, width, height, { inversionAttempts: "dontInvert" });
    if (code?.data) return code.data;

    code = jsQR(clamped, width, height, { inversionAttempts: "onlyInvert" });
    return code?.data || null;
  } catch { return null; }
}

async function replyLineMessage(replyToken: string, messages: any[]) {
  if (!replyToken || replyToken === "00000000000000000000000000000000") return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
}

async function pushLineMessage(toUserId: string, messages: any[]) {
  if (!toUserId) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: toUserId, messages }),
  });
}

async function sendDiscordAlert(username: string, accessCode: string, isExisting: boolean, fileName: string, msgId: string, orderId: string, imageUrl: string | null) {
  try {
    const userTypeTag = isExisting ? "🟢 ลูกค้าเก่า" : "🆕 ลูกค้าใหม่";
    const formData = new FormData();

    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        formData.append("files[0]", await imgRes.blob(), "slip.jpg");
      }
    }

    const payload = {
      embeds: [{
        title: "📌 รายการแจ้งชำระเงินใหม่!",
        color: 0xE2A99B,
        fields: [
          { name: "👤 ชื่อผู้ใช้งาน", value: username, inline: true },
          { name: "🔑 รหัสผ่าน (Passcode)", value: `\`${accessCode}\``, inline: true },
          { name: "📚 วิชาที่เลือก", value: fileName },
          { name: "🆔 Order ID", value: `\`${orderId}\``, inline: true },
          { name: "🏷️ สถานะ", value: userTypeTag, inline: true }
        ],
        image: { url: imageUrl ? "attachment://slip.jpg" : undefined }
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 3, label: "✅ อนุมัติ (Approve)", custom_id: `app|${orderId}` },
          { type: 2, style: 4, label: "❌ ปฏิเสธ (Reject)", custom_id: `rej|${orderId}` }
        ]
      }]
    };

    formData.append("payload_json", JSON.stringify(payload));

    await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      body: formData
    });
  } catch (err) { console.error("[Discord Exception]:", err); }
}

async function sendDiscordAdminContactAlert(displayName: string, lineUserId: string) {
  try {
    await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [{
          title: "🚨 [แจ้งเตือนด่วน] ลูกค้าต้องการติดต่อแอดมิน!",
          color: 0xFF0000,
          fields: [
            { name: "👤 ชื่อลูกค้า (LINE)", value: displayName, inline: true },
            { name: "🆔 User ID", value: `\`${lineUserId}\``, inline: true },
            { name: "💬 คำแนะนำ", value: "กรุณาเปิด LINE Official Account Manager เพื่อแชทกับลูกค้าโดยตรง" }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (e) { console.error(e); }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const bodyText = await req.text();
  const discordSig = req.headers.get("x-signature-ed25519");
  const discordTimestamp = req.headers.get("x-signature-timestamp");

  // --- 1. จัดการ Discord Interaction ---
  if (discordSig && discordTimestamp) {
    const isValidDiscord = await verifyDiscordSignature(bodyText, discordSig, discordTimestamp);
    if (!isValidDiscord) return new Response("Invalid request signature", { status: 401 });

    const discordData = JSON.parse(bodyText);

    if (discordData.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), { headers: { "Content-Type": "application/json" } });
    }

    // Command สรุปยอดขาย /summary
    if (discordData.type === 2) {
      const commandName = discordData.data?.name;
      if (commandName === "summary") {
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: approvedOrders } = await supabase.from("orders").select("*").eq("status", "approved").gte("created_at", `${todayStr}T00:00:00Z`);

        let totalCount = 0;
        let totalSales = 0;
        if (approvedOrders) {
          totalCount = approvedOrders.length;
          approvedOrders.forEach(o => {
            totalSales += (o.file_name === FILE_2 ? 20 : 5);
          });
        }

        return new Response(JSON.stringify({
          type: 4,
          data: {
            embeds: [{
              title: "📊 สรุปยอดขายประจำวันนี้",
              color: 0x5865F2,
              fields: [
                { name: "🛒 จำนวนที่ขายได้", value: `${totalCount} รายการ`, inline: true },
                { name: "💰 ยอดเงินรวม", value: `${totalSales} บาท`, inline: true }
              ],
              timestamp: new Date().toISOString()
            }]
          }
        }), { headers: { "Content-Type": "application/json" } });
      }
    }

    // กดปุ่มใน Discord
    if (discordData.type === 3) {
      const [actionType, orderId] = (discordData.data?.custom_id || "").split("|");
      const { data: orderRow } = await supabase.from("orders").select("*").eq("id", orderId).single();

      if (orderRow) {
        const displayName = await getLineProfile(orderRow.student_line_id);
        const userAccount = await getOrCreateUserAccess(orderRow.student_line_id, displayName);
        const finalUsername = userAccount.username;
        const finalAccessCode = userAccount.accessCode;
        const selectedFile = orderRow.file_name;

        if (actionType === "app") {
          const processApprove = async () => {
            await supabase.from("orders").update({ status: "approved" }).eq("id", orderId);
            const pdfFileName = selectedFile.endsWith(".pdf") ? selectedFile : `${selectedFile}.pdf`;
            const { data: existingPerm } = await supabase.from("user_permissions").select("id").eq("username", finalUsername).eq("file_name", pdfFileName).limit(1);
            if (!existingPerm || existingPerm.length === 0) {
              await supabase.from("user_permissions").insert([{ username: finalUsername, file_name: pdfFileName }]);
            }

            let replyText = `เรียบร้อยแล้วน้าา สามารถกดเข้าดูเอกสารผ่านลิงก์ด้านล่างนี้ได้เลยค่ะ ✨\n\n🌐 เว็บไซต์: https://my-keyspace.vercel.app/\n👤 ชื่อผู้ใช้งาน: ${finalUsername}\n🔑 รหัสผ่าน: ${finalAccessCode}\n\n🔒 กระซิบแจ้งนิดนึงน้า: เพื่อความปลอดภัยของข้อมูล ขอความร่วมมือไม่แคปหน้าจอ บันทึกภาพ หรือคัดลอกข้อความนะคะ ขอบคุณที่น่ารักและให้ความร่วมมือค่าา 🌷`;
            if (userAccount.isExisting) {
              replyText = `เรียบร้อยแล้วน้าา สามารถกดเข้าดูเอกสารผ่านลิงก์ด้านล่างนี้ได้เลยค่ะ ✨\n\n🌐 เว็บไซต์: https://my-keyspace.vercel.app/\n👤 ชื่อผู้ใช้งาน: ${finalUsername}\n🔑 รหัสผ่าน: ${finalAccessCode}\n\n✨ เพิ่มสิทธิ์การเข้าถึงไฟล์ใหม่เรียบร้อยแล้วน้าา คุณลูกค้าสามารถใช้ข้อมูลเดิมเข้าใช้งานเพื่อดูวิชาใหม่ได้เลยค่าา 💕\n\n🔒 กระซิบแจ้งนิดนึงน้า: เพื่อความปลอดภัยของข้อมูล ขอความร่วมมือไม่แคปหน้าจอ บันทึกภาพ หรือคัดลอกข้อความนะคะ ขอบคุณที่น่ารักและให้ความร่วมมือค่าา 🌷`;
            }
            await pushLineMessage(orderRow.student_line_id, [{ type: "text", text: replyText }]);
          };

          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processApprove());
          else processApprove();

          return new Response(JSON.stringify({
            type: 7,
            data: {
              embeds: [{
                title: "✅ ทำรายการสำเร็จ (อนุมัติเรียบร้อย)",
                color: 0x00B900,
                fields: [
                  { name: "👤 ชื่อผู้ใช้งาน", value: finalUsername, inline: true },
                  { name: "🔑 รหัสผ่าน (Passcode)", value: `\`${finalAccessCode}\``, inline: true },
                  { name: "📚 วิชาที่เลือก", value: selectedFile },
                  { name: "🆔 Order ID", value: `\`${orderId}\``, inline: true }
                ]
              }],
              components: []
            }
          }), { headers: { "Content-Type": "application/json" } });

        } else if (actionType === "rej") {
          const processReject = async () => {
            // ล้างค่า qr_data = null เพื่อให้ลูกค้าส่งสลิปเดิมซ้ำเพื่อแก้ไขได้
            await supabase.from("orders").update({ status: "rejected", qr_data: null }).eq("id", orderId);
            await pushLineMessage(orderRow.student_line_id, [{ type: "text", text: "⚠️ ขออภัยด้วยน้าา ระบบไม่สามารถอนุมัติรายการชำระเงินได้\nกรุณาตรวจสอบสลิปแล้วลองส่งใหม่อีกครั้ง หรือกดปุ่ม 'ติดต่อแอดมิน' ได้เลยนะคะ 🌷" }]);
          };

          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processReject());
          else processReject();

          return new Response(JSON.stringify({
            type: 7,
            data: {
              embeds: [{
                title: "❌ ปฏิเสธรายการนี้เรียบร้อยแล้ว (ปลดล็อกสลิปแล้ว)",
                color: 0xFF0000,
                fields: [
                  { name: "👤 ชื่อผู้ใช้งาน", value: finalUsername, inline: true },
                  { name: "🔑 รหัสผ่าน (Passcode)", value: `\`${finalAccessCode}\``, inline: true },
                  { name: "📚 วิชาที่เลือก", value: selectedFile },
                  { name: "🆔 Order ID", value: `\`${orderId}\``, inline: true }
                ]
              }],
              components: []
            }
          }), { headers: { "Content-Type": "application/json" } });
        }
      }
    }
  }

  // --- 2. จัดการ LINE Webhook ---
  const lineSig = req.headers.get("x-line-signature");
  if (!await verifyLineSignature(bodyText, lineSig)) return new Response("Forbidden", { status: 403 });

  const lineData = JSON.parse(bodyText);

  for (const event of (lineData.events || [])) {
    try {
      if (event.type === "message" && event.message.type === "image") {
        const replyToken = event.replyToken;
        const messageId = event.message.id;
        const studentLineId = event.source?.userId || "";

        const imgRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, { headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` } });
        if (imgRes.ok) {
          const imgBuffer = new Uint8Array(await imgRes.arrayBuffer());
          
          // --- บันทึกรูปสลิปลง Supabase Storage Bucket 'slips' ---
          const fileName = `${studentLineId}_${Date.now()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("slips")
            .upload(fileName, imgBuffer, { contentType: "image/jpeg", upsert: true });

          let publicUrl: string | null = null;
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("slips").getPublicUrl(fileName);
            publicUrl = urlData.publicUrl;
          }

          // สแกน QR Code
          const scannedQrData = await scanQRCodeFromBuffer(imgBuffer);

          if (!scannedQrData || scannedQrData.trim() === "") {
            await replyLineMessage(replyToken, [{ type: "text", text: "⚠️ ระบบไม่พบ QR Code บนภาพสลิป กรุณาส่งภาพสลิปที่ชัดเจนใหม่อีกครั้งน้าา 🌷" }]);
            continue;
          }

          const cleanQr = scannedQrData.trim();
          const { data: dup } = await supabase.from("orders").select("id").eq("qr_data", cleanQr).neq("status", "rejected").limit(1);

          if (dup && dup.length > 0) {
            await replyLineMessage(replyToken, [{ type: "text", text: "⚠️ สลิปใบนี้เคยถูกใช้งานในระบบไปแล้ว ไม่สามารถใช้ซ้ำได้น้าา หากมีปัญหาหรือข้อสงสัยสามารถกดปุ่มติดต่อแอดมินได้เลยค่าา 🌷" }]);
          } else {
            // บันทึกลง orders พร้อมใส่ image_url
            const { data: draft } = await supabase.from("orders").insert([{
              student_line_id: studentLineId,
              transaction_ref: messageId,
              file_name: "Pending Selection",
              status: "draft",
              qr_data: cleanQr,
              image_url: publicUrl
            }]).select().single();

            if (draft) {
              await replyLineMessage(replyToken, [{
                type: "flex", altText: "กรุณาเลือกวิชาที่ต้องการสั่งซื้อ", contents: {
                  type: "bubble",
                  body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "💖 สแกนสลิปเรียบร้อยแล้วค่าา\nกรุณาเลือกวิชาที่ต้องการ:", weight: "bold", color: "#E2A99B", wrap: true }] },
                  footer: {
                    type: "box", layout: "vertical", spacing: "sm", contents: [
                      { type: "button", style: "primary", color: "#E2A99B", action: { type: "postback", label: "🤖 Smart Digital & AI (6฿)", data: `action=select_file&order_id=${draft.id}&file_idx=1` } },
                      { type: "button", style: "primary", color: "#C88675", action: { type: "postback", label: "🇬🇧 Mooc English Commu (20฿)", data: `action=select_file&order_id=${draft.id}&file_idx=2` } },
                      { type: "button", style: "secondary", color: "#FF6B6B", action: { type: "postback", label: "💬 ติดต่อแอดมิน", data: `action=contact_admin` } }
                    ]
                  }
                }
              }]);
            }
          }
        }
      }

      else if (event.type === "postback") {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get("action");
        const orderId = params.get("order_id") || "";
        const studentLineId = event.source?.userId || "";

        if (action === "contact_admin") {
          const displayName = await getLineProfile(studentLineId);
          await sendDiscordAdminContactAlert(displayName, studentLineId);
          await replyLineMessage(event.replyToken, [{ type: "text", text: "🔔 ระบบได้ส่งข้อความแจ้งเตือนไปยังแอดมินเรียบร้อยแล้วค่ะ แอดมินจะรีบมาตอบแชทโดยเร็วที่สุดนะคะ 🌷" }]);
        }

        else if (action === "select_file") {
          const selectedFile = params.get("file_idx") === "2" ? FILE_2 : FILE_1;
          await supabase.from("orders").update({ file_name: selectedFile }).eq("id", orderId);

          await replyLineMessage(event.replyToken, [{
            type: "flex", altText: "ยืนยันรายการสั่งซื้อ", contents: {
              type: "bubble",
              body: { 
                type: "box", layout: "vertical", contents: [
                  { type: "text", text: "📚 วิชาที่คุณเลือก:", size: "sm", color: "#888888" },
                  { type: "text", text: selectedFile, weight: "bold", size: "md", wrap: true, margin: "xs" },
                  { type: "text", text: "หากต้องการเปลี่ยนวิชา สามารถกดเลือกใหม่ได้เลยน้าา 🌷", size: "xs", color: "#aaaaaa", wrap: true, margin: "md" }
                ] 
              },
              footer: {
                type: "box", layout: "vertical", spacing: "sm", contents: [
                  { type: "button", style: "primary", color: "#00B900", action: { type: "postback", label: "✅ ยืนยันส่งข้อมูล", data: `action=confirm_submit&order_id=${orderId}` } },
                  { type: "button", style: "secondary", color: "#E2A99B", action: { type: "postback", label: "🔄 เปลี่ยนเป็น Smart Digital (6฿)", data: `action=select_file&order_id=${orderId}&file_idx=1` } },
                  { type: "button", style: "secondary", color: "#C88675", action: { type: "postback", label: "🔄 เปลี่ยนเป็น Mooc English (20฿)", data: `action=select_file&order_id=${orderId}&file_idx=2` } },
                  { type: "button", style: "secondary", color: "#FF6B6B", action: { type: "postback", label: "💬 ติดต่อแอดมิน", data: `action=contact_admin` } }
                ]
              }
            }
          }]);
        } 
        
        else if (action === "confirm_submit") {
          const { data: draftOrder } = await supabase.from("orders").select("*").eq("id", orderId).single();
          if (draftOrder && draftOrder.status === "draft") {
            const displayName = await getLineProfile(studentLineId);
            const userAccount = await getOrCreateUserAccess(studentLineId, displayName);

            await supabase.from("orders").update({ status: "pending" }).eq("id", orderId);

            const lineMsg = isBusinessHours()
              ? "ได้รับข้อมูลเรียบร้อยแล้วน้าา รอระบบตรวจสอบสักครู่นะคะ ✨💖"
              : "ได้รับข้อมูลเรียบร้อยแล้วน้าา ✨\nเนื่องจากอยู่นอกเวลาทำการ (09:30 - 22:00 น.) แอดมินจะตรวจสอบพร้อมส่งข้อมูลให้ในเวลา 09:30 น. ของวันถัดไปนะคะ 🌷";
            
            await replyLineMessage(event.replyToken, [{ type: "text", text: lineMsg }]);

            await sendDiscordAlert(
              userAccount.username,
              userAccount.accessCode,
              userAccount.isExisting,
              draftOrder.file_name,
              draftOrder.transaction_ref,
              orderId,
              draftOrder.image_url
            );
          }
        }
      }
    } catch (e) { console.error("Event Error:", e); }
  }

  return new Response("OK", { status: 200 });
});