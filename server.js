const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os'); 

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'assets', 'style_covers');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E4) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'styles.json');
const TICKETS_FILE = path.join(__dirname, 'tickets.json'); 
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
const LOCAL_IP = getLocalIp();

// ==========================================
// API UPLOAD CLOUD MENGGUNAKAN IMGBB MURNI
// ==========================================
app.post('/api/upload', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ success: false, message: "Gambar tidak ditemukan" });

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `Photobooth_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        
        // 1. Simpan selalu ke folder lokal komputer (Backup Utama di Hardisk)
        const resultsDir = path.join(__dirname, 'assets', 'results');
        if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
        const localFilePath = path.join(resultsDir, filename);
        fs.writeFileSync(localFilePath, buffer);
        
        // Default URL menggunakan jaringan lokal (WiFi) agar QR Code tetap terbentuk jika ImgBB gagal
        let finalUrl = `http://${LOCAL_IP}:3000/assets/results/${filename}`; 
        
        // 2. Upload ke ImgBB menggunakan API Key yang baru Anda berikan
        const IMGBB_API_KEY = "f88596463695b38c9334014dd973e06b"; 
        
        try {
            const params = new URLSearchParams();
            params.append('key', IMGBB_API_KEY);
            params.append('image', base64Data);

            const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: params
            });
            const imgbbData = await imgbbRes.json();
            
            if (imgbbData.success) {
                finalUrl = imgbbData.data.url; 
                console.log(`[ImgBB] Sukses upload, QR Code siap: ${finalUrl}`);
            } else {
                console.log(`[ImgBB] Gagal dari server, bypass otomatis ke jaringan lokal`);
            }
        } catch (err) {
            console.error(`[ImgBB] Gagal koneksi: bypass ke lokal - ${err.message}`);
        }

        res.json({ success: true, url: finalUrl });

    } catch (error) {
        console.error("Fatal Upload Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// API TIKET
// ==========================================
app.get('/api/tickets', (req, res) => {
    if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, JSON.stringify({}, null, 4));
    res.json(JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')));
});

app.post('/api/tickets/generate', (req, res) => {
    const token = Math.random().toString(36).substring(2, 8).toUpperCase(); 
    let db = fs.existsSync(TICKETS_FILE) ? JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')) : {};
    db[token] = { status: 'active', createdAt: new Date().toISOString() };
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(db, null, 4));
    res.json({ success: true, token: token });
});

app.post('/api/tickets/validate', (req, res) => {
    const { token } = req.body;
    let db = fs.existsSync(TICKETS_FILE) ? JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')) : {};
    const upperToken = token?.toUpperCase();
    if (db[upperToken] && db[upperToken].status === 'active') {
        db[upperToken].status = 'used';
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(db, null, 4));
        res.json({ success: true, message: "Tiket valid!" });
    } else {
        res.status(401).json({ success: false, message: "Tiket tidak valid/terpakai!" });
    }
});

app.delete('/api/tickets/:id', (req, res) => {
    let db = fs.existsSync(TICKETS_FILE) ? JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')) : {};
    const token = req.params.id;
    if (db[token]) {
        delete db[token];
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(db, null, 4));
        res.json({ success: true, message: "Tiket berhasil dihapus" });
    } else {
        res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });
    }
});

// ==========================================
// API STYLES (MURNI PROMPT)
// ==========================================
app.get('/api/styles', (req, res) => {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 4));
    res.json(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
});

app.post('/api/styles', upload.any(), (req, res) => {
    try {
        const { styleId, name, description, prompt_template, optionsData, customData } = req.body;
        if (!styleId || !name || !prompt_template) return res.status(400).json({ success: false, message: "Data tidak lengkap" });

        let dbData = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};
        let parsedOptions = optionsData ? JSON.parse(optionsData) : [];
        let parsedCustomData = customData ? JSON.parse(customData) : {};

        const mainCoverFile = req.files ? req.files.find(f => f.fieldname === 'coverImage') : null;
        const finalMainCover = mainCoverFile ? `assets/style_covers/${mainCoverFile.filename}` : (dbData[styleId]?.cover || "");

        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const match = file.fieldname.match(/^optImg_(\d+)_(\d+)$/);
                if (match) {
                    const gIdx = parseInt(match[1]); const cIdx = parseInt(match[2]);
                    if (parsedOptions[gIdx] && parsedOptions[gIdx].choices[cIdx]) {
                        parsedOptions[gIdx].choices[cIdx].img = `assets/style_covers/${file.filename}`;
                    }
                }
            });
        }

        dbData[styleId] = {
            ...(dbData[styleId] || {}), ...parsedCustomData,
            name, 
            cover: finalMainCover, 
            description: description || "",
            prompt_template: prompt_template.trim(),
            options: parsedOptions
        };

        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 4));
        res.json({ success: true, message: "Berhasil disimpan!" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/styles/:id', (req, res) => {
    let dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    delete dbData[req.params.id];
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 4));
    res.json({ success: true });
});

// ==========================================
// API SETTINGS
// ==========================================
app.get('/api/settings', (req, res) => {
    if(!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-image-2.5-sunburst' }, null, 4));
    res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
});

app.post('/api/settings', (req, res) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 4));
    res.json({ success: true });
});

app.use('/assets', express.static(path.join(__dirname, 'assets')));

const PORT = 3000;
app.listen(PORT, () => { 
    console.log(`🚀 Server ImgBB aktif di http://${LOCAL_IP}:${PORT}`); 
});