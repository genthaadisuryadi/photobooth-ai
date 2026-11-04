// ==========================================
// KONFIGURASI API (FULL HOSTING SERVERLESS)
// ==========================================
const API_URLS = {
    settings: 'https://api.agenticaicenter.id/settings.php',
    styles: 'https://api.agenticaicenter.id/styles.php',
    tickets: 'https://api.agenticaicenter.id/tickets.php',
    upload: 'https://api.agenticaicenter.id/upload.php'
};

// ==========================================
// STATE APLIKASI
// ==========================================
let appSettings = {
    apiKey: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-image-2.5-sunburst'
};
let availableStyles = {};
let selectedStyleId = null;
let videoStream = null;
let capturedBase64 = null;

// DOM Elements (Pastikan ID HTML Anda sesuai)
const elements = {
    video: document.getElementById('camera-stream'),
    canvas: document.getElementById('photo-canvas'),
    resultImage: document.getElementById('result-image'),
    qrContainer: document.getElementById('qr-code-container'),
    btnCapture: document.getElementById('btn-capture'),
    ticketInput: document.getElementById('ticket-input'),
    btnSubmitTicket: document.getElementById('btn-submit-ticket'),
    loadingScreen: document.getElementById('loading-screen'),
    styleContainer: document.getElementById('style-container')
};

// ==========================================
// INISIALISASI AWAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();
    initCamera();
    setupEventListeners();
});

// ==========================================
// PENGAMBILAN DATA DARI API HOSTING
// ==========================================
async function loadSettings() {
    try {
        const response = await fetch(API_URLS.settings);
        if (response.ok) {
            const data = await response.json();
            appSettings = { ...appSettings, ...data };
            console.log("[System] Settings berhasil dimuat dari server.");
        }
    } catch (error) {
        console.error("[Error] Gagal memuat settings:", error);
    }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) {
            availableStyles = await response.json();
            renderStyleOptions();
            console.log("[System] Katalog Style berhasil dimuat.");
        }
    } catch (error) {
        console.error("[Error] Gagal memuat styles:", error);
    }
}

async function validateTicket(token) {
    try {
        showLoading("Memvalidasi tiket...");
        const response = await fetch(`${API_URLS.tickets}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            alert("Tiket Valid! Silakan pilih gaya dan mulai berfoto.");
            // Pindah Stage ke pemilihan gaya atau langsung ke kamera
            return true;
        } else {
            alert("Tiket tidak valid atau sudah terpakai.");
            return false;
        }
    } catch (error) {
        hideLoading();
        alert("Terjadi kesalahan jaringan saat memvalidasi tiket.");
        console.error("[Error] Validasi tiket gagal:", error);
        return false;
    }
}

// ==========================================
// KONTROL KAMERA
// ==========================================
async function initCamera() {
    if (!elements.video) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
            audio: false
        });
        elements.video.srcObject = videoStream;
        elements.video.play();
    } catch (error) {
        console.error("[Error] Gagal mengakses kamera:", error);
        alert("Kamera tidak terdeteksi atau izin ditolak browser.");
    }
}

function takePhoto() {
    if (!elements.video || !elements.canvas) return;
    
    const context = elements.canvas.getContext('2d');
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
    
    // Flip horizontal agar seperti cermin
    context.translate(elements.canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(elements.video, 0, 0, elements.canvas.width, elements.canvas.height);
    
    capturedBase64 = elements.canvas.toDataURL('image/jpeg', 0.9);
    console.log("[System] Foto berhasil ditangkap.");
    
    // Lanjut ke proses AI
    processAIGeneration();
}

// ==========================================
// PROSES AI (CLIENT-SIDE KE OPENAI)
// ==========================================
async function processAIGeneration() {
    if (!capturedBase64) return alert("Belum ada foto yang ditangkap.");
    if (!selectedStyleId || !availableStyles[selectedStyleId]) return alert("Pilih gaya foto terlebih dahulu.");
    if (!appSettings.apiKey) return alert("API Key OpenAI belum dikonfigurasi di Settings.");

    showLoading("AI sedang memproses mahakarya Anda...");

    try {
        const styleData = availableStyles[selectedStyleId];
        const promptText = styleData.prompt_template || "Creative portrait, highly detailed.";
        
        // Membersihkan header base64 untuk OpenAI API
        const base64Image = capturedBase64.replace(/^data:image\/\w+;base64,/, "");

        const payload = {
            model: appSettings.aiModel,
            prompt: promptText,
            image: base64Image, // Struktur payload menyesuaikan endpoint DALL-E/Image API yang dipakai
            n: 1,
            size: "1024x1024"
        };

        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appSettings.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        if (data.data && data.data[0] && data.data[0].b64_json) {
            const finalImageBase64 = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            if (elements.resultImage) elements.resultImage.src = finalImageBase64;
            
            // Upload hasil ke server PMB untuk QR Code
            await finalizePhotoAndUpload(finalImageBase64);
        } else {
            throw new Error("Format respons OpenAI tidak sesuai dugaan.");
        }

    } catch (error) {
        console.error("[Error] AI Processing gagal:", error);
        alert(`Gagal memproses gambar AI: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// ==========================================
// UPLOAD KE HOSTING & GENERATE QR CODE
// ==========================================
async function finalizePhotoAndUpload(imageBase64) {
    showLoading("Menyiapkan QR Code...");
    try {
        const response = await fetch(API_URLS.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 })
        });
        
        const data = await response.json();
        
        if (data.success && data.url) {
            console.log(`[System] Foto berhasil di-upload ke: ${data.url}`);
            generateQR(data.url);
            // Pindah Stage ke tampilan QR Code
        } else {
            throw new Error(data.message || "Gagal upload gambar.");
        }
    } catch (error) {
        console.error("[Error] Upload ke server gagal:", error);
        alert("Gagal mengunggah foto ke server. Silakan coba lagi.");
    } finally {
        hideLoading();
    }
}

function generateQR(url) {
    if (!elements.qrContainer) return;
    elements.qrContainer.innerHTML = ""; // Bersihkan QR sebelumnya
    
    // Pastikan library qrcode.js sudah di-load di file HTML Anda
    new QRCode(elements.qrContainer, {
        text: url,
        width: 256,
        height: 256,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    console.log("[System] QR Code berhasil dirender.");
}

// ==========================================
// FUNGSI PENDUKUNG & EVENT LISTENERS
// ==========================================
function renderStyleOptions() {
    if (!elements.styleContainer) return;
    elements.styleContainer.innerHTML = "";
    
    for (const [id, style] of Object.entries(availableStyles)) {
        const div = document.createElement('div');
        div.className = 'style-card';
        div.innerHTML = `
            <img src="${style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg'}" alt="${style.name}">
            <h3>${style.name}</h3>
        `;
        div.onclick = () => {
            selectedStyleId = id;
            // Tambahkan class active/border untuk UX
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        };
        elements.styleContainer.appendChild(div);
    }
}

function setupEventListeners() {
    if (elements.btnSubmitTicket) {
        elements.btnSubmitTicket.addEventListener('click', () => {
            const token = elements.ticketInput.value.trim();
            if (token) validateTicket(token);
        });
    }

    if (elements.btnCapture) {
        elements.btnCapture.addEventListener('click', () => {
            // Animasi hitung mundur bisa dipanggil di sini sebelum takePhoto()
            takePhoto();
        });
    }
}

function showLoading(message = "Loading...") {
    if (elements.loadingScreen) {
        elements.loadingScreen.querySelector('span').innerText = message;
        elements.loadingScreen.style.display = "flex";
    }
}

function hideLoading() {
    if (elements.loadingScreen) {
        elements.loadingScreen.style.display = "none";
    }
}

// Fungsi Simpan Admin (jika halaman ini juga menangani panel admin)
async function saveAdminSettings(newSettings) {
    try {
        const response = await fetch(API_URLS.settings, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
        const data = await response.json();
        if(data.success) {
            alert("Pengaturan berhasil disimpan ke server!");
            await loadSettings();
        }
    } catch(err) {
        console.error("Gagal simpan settings", err);
    }
}