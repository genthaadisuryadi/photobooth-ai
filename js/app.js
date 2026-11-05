// ==========================================
// KONFIGURASI API SERVERLESS
// ==========================================
const API_URLS = {
    settings: 'https://api.agenticaicenter.id/settings.php',
    styles: 'https://api.agenticaicenter.id/styles.php',
    tickets: 'https://api.agenticaicenter.id/tickets.php',
    upload: 'https://api.agenticaicenter.id/upload.php'
};

let appSettings = { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-image-2.5-sunburst' };
let availableStyles = {};
let selectedStyleId = null;
let selectedOptions = {}; // Menyimpan opsi (baju, landmark, dll) yang dipilih user
let pbVideoStream = null;
let pbCapturedBase64 = null;
let html5QrcodeScanner = null;

// ==========================================
// INISIALISASI UTAMA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.href.toLowerCase().includes('admin') || document.querySelector('.admin-dashboard') !== null || !document.getElementById('screen-welcome');

    if (!isAdmin) {
        setupEventListeners();
        await loadSettings();
        await loadStyles();
    }
});

async function loadSettings() {
    try {
        const response = await fetch(API_URLS.settings);
        if (response.ok) {
            const data = await response.json();
            appSettings = { ...appSettings, ...data };
        }
    } catch (error) { console.error("Gagal load settings:", error); }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) availableStyles = await response.json();
    } catch (error) { console.warn("Gagal terhubung ke API Styles."); } 
    finally {
        initHeroAnimation();
        renderStyleOptions();
    }
}

function getImageUrl(path) {
    if (!path) return '/assets/placeholder.jpg';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path; 
    if (path.startsWith('assets/')) return `/${path}`; 
    return `https://api.agenticaicenter.id/${path}`;
}

// ==========================================
// FUNGSI GLOBAL & EVENT LISTENER
// ==========================================
window.switchScreen = (screenId) => {
    document.querySelectorAll('section[id^="screen-"]').forEach(s => s.classList.add('screen-hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('screen-hidden');
};

function setupEventListeners() {
    document.getElementById('btn-start')?.addEventListener('click', () => { switchScreen('screen-pin'); initQRScanner(); });
    document.getElementById('btn-cancel-token')?.addEventListener('click', () => { 
        switchScreen('screen-welcome'); 
        if (html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
    });
    document.getElementById('btn-submit-token')?.addEventListener('click', window.submitToken);
    
    // Perbaikan: Tombol lanjut ke kamera hanya aktif jika opsi sudah lengkap
    document.getElementById('btn-next-integrated')?.addEventListener('click', window.confirmIntegratedOptionsAndGo);

    document.getElementById('btn-capture')?.addEventListener('click', takePhoto);
    document.getElementById('btn-retake')?.addEventListener('click', window.retakePhoto);
    document.getElementById('btn-proceed-ai')?.addEventListener('click', window.startAIProcessing);
}

window.submitToken = () => {
    const token = document.getElementById('token-input')?.value.trim();
    if (token) validateTicket(token);
    else {
        const err = document.getElementById('token-error');
        if (err) err.innerText = "Masukkan kode tiket terlebih dahulu!";
    }
};

window.confirmIntegratedOptionsAndGo = () => {
    // Validasi apakah semua opsi wajib sudah dipilih
    const styleData = availableStyles[selectedStyleId];
    if (styleData && styleData.options && styleData.options.length > 0) {
        let isComplete = true;
        styleData.options.forEach(optGroup => {
            if (!optGroup.optional) {
                // Cek apakah kategori ini harusnya muncul (berdasarkan dependency)
                let shouldShow = true;
                if (optGroup.depends_on) {
                    const parentVal = selectedOptions[optGroup.depends_on];
                    if (!parentVal) shouldShow = false;
                }
                
                if (shouldShow && !selectedOptions[optGroup.id]) {
                    isComplete = false;
                }
            }
        });
        
        if (!isComplete) {
            alert("Harap lengkapi semua pilihan gaya di panel kanan terlebih dahulu.");
            return;
        }
    }

    switchScreen('screen-capture');
    initWebcam();
};

window.retakePhoto = () => document.getElementById('capture-decision')?.classList.add('hidden');
window.startAIProcessing = () => processAIGeneration();

// ==========================================
// ANIMASI PANGGUNG
// ==========================================
function initHeroAnimation() {
    const leftContainer = document.getElementById('welcome-gallery-left');
    const rightContainer = document.getElementById('welcome-gallery-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.innerHTML = ''; rightContainer.innerHTML = '';
    let styleKeys = Object.keys(availableStyles);
    let isDummy = false;
    
    if (styleKeys.length === 0) {
        isDummy = true;
        styleKeys = [0, 1, 2, 3];
        const dummies = [
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
        ];
        availableStyles = styleKeys.map((_, i) => ({ cover: dummies[i] }));
    }

    if (styleKeys.length > 10) styleKeys = styleKeys.slice(0, 10);
    const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];

    imagesToRender.forEach((key, index) => {
        const style = availableStyles[key];
        const imgSrc = isDummy ? style.cover : getImageUrl(style.cover);
        const imgHtml = `<img src="${imgSrc}" onerror="this.src='/assets/placeholder.jpg'" class="w-full h-[280px] object-cover rounded-2xl border border-white/10 shadow-xl mb-3">`;

        if (index % 2 === 0) leftContainer.innerHTML += imgHtml;
        else rightContainer.innerHTML += imgHtml;
    });
    if (isDummy) availableStyles = {};
}

// ==========================================
// RENDER PILIHAN STYLE (KIRI) DAN OPSI KUSTOM (KANAN)
// ==========================================
function renderStyleOptions() {
    const container = document.getElementById('style-list-container');
    if (!container) return;
    container.innerHTML = "";

    if (Object.keys(availableStyles).length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                <p class="text-sm font-medium text-booth-muted">Belum ada gaya yang tersedia.</p>
                <p class="text-xs text-white/40 mt-1">Silakan tambahkan gaya dan gambar melalui Admin Panel.</p>
            </div>
        `;
        return;
    }

    for (const [id, style] of Object.entries(availableStyles)) {
        const imgSrc = getImageUrl(style.cover);
        const div = document.createElement('div');
        div.className = 'style-card cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4';
        
        div.innerHTML = `
            <img src="${imgSrc}" onerror="this.src='/assets/placeholder.jpg'" class="w-16 h-16 object-cover rounded-lg shadow-md border border-white/10">
            <div>
                <h3 class="font-bold text-white">${style.name}</h3>
                <p class="text-xs text-booth-muted line-clamp-1">${style.description || 'Gaya Interaktif'}</p>
            </div>
        `;
        
        div.onclick = () => {
            selectedStyleId = id;
            selectedOptions = {}; // Reset pilihan opsi sebelumnya
            
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10'));
            div.classList.add('border-booth-accent', 'bg-booth-accent/10');

            // Update Panel Kanan
            const previewImg = document.getElementById('integrated-preview-img');
            const previewName = document.getElementById('integrated-preview-name');
            const previewDesc = document.getElementById('integrated-preview-desc');
            const btnNext = document.getElementById('btn-next-integrated');

            if (previewImg) previewImg.src = imgSrc;
            if (previewName) previewName.innerText = style.name;
            if (previewDesc) previewDesc.innerText = style.description || style.prompt_template;
            if (btnNext) btnNext.disabled = false;

            // RENDER FORM OPSI DI PANEL KANAN BAWAH (Sub-Style seperti Chibi, Eiffel, dll)
            renderSubStyleForm(style);
        };
        container.appendChild(div);
    }
}

function renderSubStyleForm(styleData) {
    let formContainer = document.getElementById('integrated-options-form');
    
    // Jika container form tidak ada di HTML, buat otomatis di bawah previewDesc
    if (!formContainer) {
        const descEl = document.getElementById('integrated-preview-desc');
        if (descEl) {
            formContainer = document.createElement('div');
            formContainer.id = 'integrated-options-form';
            formContainer.className = 'mt-6 flex flex-col gap-6';
            descEl.parentNode.insertBefore(formContainer, descEl.nextSibling);
        } else return;
    }

    formContainer.innerHTML = ''; // Bersihkan form sebelumnya

    if (!styleData.options || styleData.options.length === 0) return;

    styleData.options.forEach(optGroup => {
        const groupDiv = document.createElement('div');
        groupDiv.className = `opt-group-${optGroup.id} flex flex-col gap-3`;
        
        // Logika Menyembunyikan Kategori Berdasarkan Dependency (Misal: Outfit hanya muncul jika Negara dipilih)
        if (optGroup.depends_on) {
            groupDiv.style.display = 'none';
        }

        let choicesHtml = '';
        optGroup.choices.forEach(choice => {
            // Logika "Muncul Jika Induk Bernilai"
            const dependsAttr = choice.parent_value ? `data-parent-val="${choice.parent_value}"` : '';
            const hideClass = choice.parent_value ? 'hidden' : '';
            
            // Gambar Opsi (Placeholder jika kosong)
            const optImg = choice.img ? getImageUrl(choice.img) : '/assets/placeholder.jpg';

            choicesHtml += `
                <div class="choice-card ${hideClass} cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-3 transition-all"
                     ${dependsAttr}
                     onclick="selectSubOption('${optGroup.id}', '${choice.value}', this, '${optGroup.depends_on || ''}')">
                    <img src="${optImg}" onerror="this.src='/assets/placeholder.jpg'" class="w-12 h-12 object-cover rounded-md shadow-sm border border-white/10">
                    <div>
                        <h4 class="font-bold text-sm text-white">${choice.label}</h4>
                    </div>
                </div>
            `;
        });

        groupDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-booth-accent/20 text-booth-accent flex items-center justify-center text-xs font-bold font-mono border border-booth-accent/30">!</span>
                <h3 class="font-bold text-white uppercase tracking-wider text-xs">${optGroup.label} ${optGroup.optional ? '(Opsional)' : ''}</h3>
            </div>
            <div class="grid grid-cols-2 gap-3" id="choices-container-${optGroup.id}">
                ${choicesHtml}
            </div>
        `;
        
        formContainer.appendChild(groupDiv);
    });
}

// Fungsi Global untuk memilih opsi di UI Kanan
window.selectSubOption = (groupId, choiceValue, element, dependsOn) => {
    // 1. Simpan pilihan
    selectedOptions[groupId] = choiceValue;

    // 2. Beri highlight warna pada opsi yang dipilih
    const container = document.getElementById(`choices-container-${groupId}`);
    if (container) {
        container.querySelectorAll('.choice-card').forEach(el => {
            el.classList.remove('border-booth-accent', 'bg-booth-accent/10', 'ring-1', 'ring-booth-accent');
        });
    }
    element.classList.add('border-booth-accent', 'bg-booth-accent/10', 'ring-1', 'ring-booth-accent');

    // 3. Tampilkan opsi anak yang bergantung pada pilihan ini (Contoh: Negara -> Outfit)
    const styleData = availableStyles[selectedStyleId];
    if (styleData && styleData.options) {
        styleData.options.forEach(optGroup => {
            if (optGroup.depends_on === groupId) {
                const childGroupDiv = document.querySelector(`.opt-group-${optGroup.id}`);
                if (childGroupDiv) {
                    childGroupDiv.style.display = 'flex'; // Tampilkan grupnya
                    
                    // Saring pilihan di dalamnya sesuai nilai parent_value
                    const choices = childGroupDiv.querySelectorAll('.choice-card');
                    choices.forEach(card => {
                        if (card.getAttribute('data-parent-val') === choiceValue) {
                            card.classList.remove('hidden');
                        } else {
                            card.classList.add('hidden');
                        }
                    });
                }
            }
        });
    }
};

// ==========================================
// VALIDASI TIKET & KAMERA
// ==========================================
function initQRScanner() {
    if (html5QrcodeScanner) return; 
    const qrNode = document.getElementById('qr-reader');
    if (!qrNode) return;
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render((decodedText) => {
        document.getElementById('token-input').value = decodedText;
        window.submitToken();
    }, (error) => {});
}

async function validateTicket(token) {
    const errEl = document.getElementById('token-error');
    if (errEl) errEl.innerText = "Memvalidasi tiket...";
    try {
        const response = await fetch(`${API_URLS.tickets}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        const data = await response.json();
        if (data.success) {
            if (errEl) errEl.innerText = "";
            switchScreen('screen-style');
            if (html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
        } else {
            if (errEl) errEl.innerText = "Tiket tidak valid atau sudah terpakai.";
        }
    } catch (error) { if (errEl) errEl.innerText = "Gagal terhubung ke server API."; }
}

async function initWebcam() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;
    try {
        pbVideoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080, facingMode: "user" }, audio: false });
        videoEl.srcObject = pbVideoStream;
    } catch (error) { console.error("Kamera error:", error); }
}

function takePhoto() {
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('capture-canvas');
    if (!videoEl || !canvasEl) return;

    const context = canvasEl.getContext('2d');
    canvasEl.width = 1280; canvasEl.height = 720;
    context.translate(canvasEl.width, 0); context.scale(-1, 1);
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    pbCapturedBase64 = canvasEl.toDataURL('image/jpeg', 0.9);
    
    document.getElementById('capture-preview-img').src = pbCapturedBase64;
    document.getElementById('capture-decision').classList.remove('hidden');
}

// ==========================================
// PROSES AI DENGAN INJEKSI PROMPT DINAMIS
// ==========================================
async function processAIGeneration() {
    document.getElementById('capture-decision')?.classList.add('hidden');
    switchScreen('screen-review');
    document.getElementById('review-blurred-img').src = pbCapturedBase64;
    
    const updateProgress = (pct, txt) => {
        document.getElementById('ai-progress-bar').style.width = `${pct}%`;
        document.getElementById('ai-progress-text').innerText = `${pct}%`;
        document.getElementById('ai-status-text').innerText = txt;
    };

    try {
        updateProgress(20, "Menganalisis opsi yang dipilih...");
        const styleData = availableStyles[selectedStyleId];
        let finalPrompt = styleData.prompt_template || "HD Portrait";
        
        // GABUNGKAN PROMPT DARI OPSI YANG DIPILIH
        let profileTextArr = [];
        if (styleData.options) {
            styleData.options.forEach(optGroup => {
                const chosenVal = selectedOptions[optGroup.id];
                if (chosenVal) {
                    const choiceObj = optGroup.choices.find(c => c.value === chosenVal);
                    if (choiceObj && choiceObj.prompt) {
                        profileTextArr.push(choiceObj.prompt);
                    }
                }
            });
        }

        // Ganti variabel {profile_text} di dalam prompt template utama dengan gabungan prompt opsi (jika ada)
        if (profileTextArr.length > 0) {
            const addedPrompt = profileTextArr.join(' ');
            if (finalPrompt.includes('{profile_text}')) {
                finalPrompt = finalPrompt.replace('{profile_text}', addedPrompt);
            } else {
                finalPrompt += ' ' + addedPrompt;
            }
        } else {
            finalPrompt = finalPrompt.replace('{profile_text}', '');
        }

        const base64Image = pbCapturedBase64.replace(/^data:image\/\w+;base64,/, "");

        updateProgress(50, "Menerapkan gaya fotomu...");
        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appSettings.apiKey}` },
            body: JSON.stringify({ model: appSettings.aiModel, prompt: finalPrompt.trim(), image: base64Image, n: 1, size: "1024x1024" })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        if (data.data && data.data[0] && data.data[0].b64_json) {
            updateProgress(80, "Selesai! Mengunggah ke server...");
            const finalImage = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            await finalizePhotoAndUpload(finalImage, pbCapturedBase64);
            updateProgress(100, "Siap ditampilkan!");
        } else { throw new Error("Format respons AI salah."); }
    } catch (error) {
        alert(`Gagal memproses AI: ${error.message}`);
        switchScreen('screen-capture'); 
    }
}

async function finalizePhotoAndUpload(aiImageBase64, originalImageBase64) {
    try {
        const responseAi = await fetch(API_URLS.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: aiImageBase64 })
        });
        const dataAi = await responseAi.json();

        if (dataAi.success && dataAi.url) {
            document.getElementById('result-original-img').src = originalImageBase64;
            document.getElementById('result-final-img').src = aiImageBase64;
            document.getElementById('qrcode-original').innerHTML = "";
            document.getElementById('qrcode-ai').innerHTML = "";
            new QRCode(document.getElementById('qrcode-original'), { text: dataAi.url, width: 120, height: 120 });
            new QRCode(document.getElementById('qrcode-ai'), { text: dataAi.url, width: 120, height: 120 });
            
            switchScreen('screen-result');
        } else { throw new Error("Upload gagal."); }
    } catch (error) { 
        alert("Gagal mengunggah foto ke jaringan."); 
        switchScreen('screen-capture'); 
    }
}