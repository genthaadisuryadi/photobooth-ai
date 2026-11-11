// js/canvas.js

const CUSTOM_FRAME_ASSETS = {
    "none": null,
    "frame_1": "assets/frames/frame_1.png",
    "frame_2": "assets/frames/frame_2.png",
};

function renderFrameScreen() {
    const container = document.getElementById('screen-frame');
    container.innerHTML = `
        <h2 class="text-4xl font-bold mb-6 text-white">Pilih Bingkai Foto</h2>
        <div class="flex gap-4 mb-8">
            ${Object.keys(CUSTOM_FRAME_ASSETS).map(key => `
                <button onclick="applyFrame('${key}')" class="px-6 py-4 bg-gray-800 border-2 border-gray-600 hover:border-primary hover:bg-gray-700 text-white rounded-xl transition-all shadow-lg font-bold">
                    ${key.toUpperCase().replace('_', ' ')}
                </button>
            `).join('')}
        </div>
        <div class="relative p-2 bg-gray-800 rounded-2xl border-4 border-gray-700 shadow-2xl flex items-center justify-center">
            <img id="frame-preview-img" src="${AppState.aiResultImageURL}" class="max-w-full max-h-[500px] object-contain rounded-xl" />
        </div>
        <button onclick="finalizePhoto()" class="mt-10 px-12 py-5 bg-secondary hover:bg-green-600 rounded-full font-bold text-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white transition-all transform hover:scale-105">
            Lanjut Cetak & Unduh
        </button>
    `;
}

async function applyFrame(frameKey) {
    AppState.selectedFrame = frameKey;
    const previewImg = document.getElementById('frame-preview-img');
    
    if (frameKey === 'none' || !CUSTOM_FRAME_ASSETS[frameKey]) {
        previewImg.src = AppState.aiResultImageURL;
        AppState.finalImageURL = AppState.aiResultImageURL;
        return;
    }

    // Proses Layering Canvas 2D secara dinamis mengikuti dimensi foto AI
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    try {
        const aiImg = await loadImage(AppState.aiResultImageURL);
        const frameImg = await loadImage(CUSTOM_FRAME_ASSETS[frameKey]);

        // Mengikuti ukuran asli gambar AI (potret atau lanskap)
        canvas.width = aiImg.naturalWidth || 1200;
        canvas.height = aiImg.naturalHeight || 800;

        // 1. Gambar foto AI sebagai Base
        ctx.drawImage(aiImg, 0, 0, canvas.width, canvas.height);
        
        // 2. Gambar Frame PNG transparan di atasnya disesuaikan dengan ukuran kanvas
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

        const finalBase64 = canvas.toDataURL('image/jpeg', 0.95);
        previewImg.src = finalBase64;
        AppState.finalImageURL = finalBase64;
    } catch (error) {
        console.error("Gagal memuat frame:", error);
        alert("Aset bingkai tidak ditemukan. Pastikan file PNG ada di folder assets/frames/");
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function finalizePhoto() {
    if (!AppState.finalImageURL) {
        AppState.finalImageURL = AppState.aiResultImageURL;
    }
    renderResultScreen();
    navigateTo('screen-result');
}

function renderResultScreen() {
    const container = document.getElementById('screen-result');
    container.innerHTML = `
        <h2 class="text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-secondary">Foto Selesai!</h2>
        
        <div class="flex flex-col lg:flex-row gap-10 items-center bg-gray-800 p-8 rounded-3xl border-2 border-gray-700 shadow-2xl max-w-5xl w-full">
            <!-- Foto Final yang Responsif -->
            <div class="flex items-center justify-center bg-gray-900 rounded-2xl p-4 max-w-full">
                <img src="${AppState.finalImageURL}" class="max-w-full max-h-[450px] object-contain rounded-xl shadow-md border-4 border-gray-900" />
            </div>
            
            <!-- Panel Aksi -->
            <div class="flex flex-col items-center justify-center gap-6 w-full lg:w-64">
                
                <div class="p-3 bg-white rounded-xl shadow-lg transform hover:scale-105 transition-all">
                    <div id="qrcode-container"></div>
                </div>
                <p class="text-gray-300 text-sm text-center font-semibold">Scan QR untuk menyimpan foto ke HP Anda</p>
                
                <div class="w-full h-px bg-gray-700 my-2"></div>

                <div class="flex flex-col w-full gap-3">
                    <button onclick="printPhoto()" class="w-full flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 hover:bg-orange-600 rounded-full font-bold shadow-lg text-white transition-all">
                        <span>🖨️</span> Cetak Fisik
                    </button>

                    <a href="${AppState.finalImageURL}" download="AI-Photobooth-${Date.now()}.jpg" class="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-full font-bold shadow-lg text-white transition-all">
                        <span>💾</span> Unduh HD
                    </a>
                </div>
                
                <button onclick="location.reload()" class="w-full mt-4 px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-full font-bold text-white transition-all">
                    Mulai Sesi Baru
                </button>
            </div>
        </div>
    `;

    // Generate QR Code
    document.getElementById('qrcode-container').innerHTML = ""; 
    new QRCode(document.getElementById("qrcode-container"), {
        text: "Photobooth AI Experience 2026 - Image processed locally!", 
        width: 140,
        height: 140,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// Logika Cetak Jendela Baru
function printPhoto() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Cetak Foto - AI Photobooth</title>
                <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                    img { max-width: 100%; max-height: 100%; object-fit: contain; }
                    @media print {
                        @page { margin: 0; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <img src="${AppState.finalImageURL}" onload="window.print(); window.close();" />
            </body>
        </html>
    `);
    printWindow.document.close();
}