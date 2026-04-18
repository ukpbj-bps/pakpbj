/**
 * SCRIPT.JS - PROYEK PAK PBJ BPS 2026
 * Versi: Clean & Fixed
 */

// ==========================================
// 1. KONFIGURASI & DATA PENGGUNA
// ==========================================
const userData = JSON.parse(sessionStorage.getItem('userData')) || { role: 'User', name: 'Guest', email: '', picture: '', pbj: '' };
const API_URL = "https://script.google.com/macros/s/AKfycbxtj9M4J2ApefCDnS76DS0NUQQojL_owOyAHxfKZwu07nCDbmO2KRC6zSSXyrHYFxpv/exec";

let state = {
    role: sessionStorage.getItem('activeRole') || userData.role,
    lang: localStorage.getItem('lang') || 'id',
    theme: localStorage.getItem('theme') || 'light',
    unitKerja: ''
};

let allUsersData = []; 
let viewingEmail = userData.email; 
let viewingName = userData.name;   

const CACHE_KEY = 'profileCache_admin';

// ==========================================
// 2. UTILS & CACHE SYSTEM
// ==========================================
function getCachedProfile(email) {
    if (state.role === 'Admin') {
        try {
            const store = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
            return store[email] || null;
        } catch { return null; }
    } else {
        return window._userProfileCache || null;
    }
}

function setCachedProfile(email, data) {
    if (state.role === 'Admin') {
        try {
            const store = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
            store[email] = data;
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
        } catch(e) { console.warn('Cache write failed:', e); }
    } else {
        window._userProfileCache = data;
    }
}

const i18n = {
    id: { 
        nav_dash: "Beranda", nav_profile: "Profil", nav_analitik: "Analitik", nav_pengguna: "Pengguna", nav_set: "Pengaturan", nav_entry: "Usulan AK",
        sub_pak: "Data pribadi", sub_training: "Pelatihan dan Ujikom", sub_experience: "Pengalaman", 
        welcome: "Selamat Datang", loading: "Memuat data...", dev_mode: "Fitur masih dalam pengembangan", btn_save: "Simpan"
    },
    en: { 
        nav_dash: "Home", nav_profile: "Profile", nav_analitik: "Analytics", nav_pengguna: "Users", nav_set: "Settings", nav_entry: "Usulan AK",
        sub_pak: "Personal Details", sub_training: "Training & Competence", sub_experience: "Experience", 
        welcome: "Welcome", loading: "Fetching data...", dev_mode: "Under development", btn_save: "Save"
    }
};

const t = (k) => i18n[state.lang][k] || k;

const formatTanggal = (val) => {
    if (!val || val === '-' || val === '') return '-';
    const isDate = typeof val === 'string' && (val.includes('T') || val.includes(':')) && !isNaN(Date.parse(val));
    if (isDate) {
        return new Date(val).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return val;
};

// ==========================================
// 3. KONFIGURASI KOLOM (MAPPING)
// ==========================================
const customProfileFields = {
    pak: [
        { idx: 1, label: "Nama Lengkap" }, { idx: 2, label: "NIP" }, { idx: 3, label: "Nomor Karpeg" },
        { idx: 4, label: "Golongan" }, { idx: 5, label: "Pangkat" }, { idx: 11, label: "Unit Kerja"},
        { idx: 12, label: "Jabatan Fungsional" }, { idx: 13, label: "Status" }, { idx: 18, label: "Pengangkatan" },
        { idx: 19, label: "Tahun PJL / Penerimaan" }, { idx: 20, label: "TMT Jabatan" }, { idx: 21, label: "Tanggal Pelantikan" }
    ],
    training: [
        { section: "Penjenjangan Pertama", fields: [{ idx: 2, label: "Pelatihan" }, { idx: 3, label: "Hasil" }] },
        { section: "Penjenjangan Muda", fields: [{ idx: 4, label: "Pelatihan" }, { idx: 5, label: "Ujikom" }, { idx: 6, label: "Hasil" }] },
        { section: "Penjenjangan Madya", fields: [{ idx: 7, label: "Pelatihan" }, { idx: 8, label: "Ujikom" }, { idx: 9, label: "Hasil" }] }
    ],
    experience: [
        { section: "Paket Konstruksi 2022-2024", fields: [{ idx: 2, label: "Seleksi" }, { idx: 3, label: "Tender" }, { idx: 4, label: "Pendampingan" }] },
        { section: "Portofolio", fields: [{ idx: 5, label: "Portofolio Madya JK Tertentu" }] }
    ]
};

// ==========================================
// 4. CORE APP LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed && window.innerWidth >= 992) {
        document.body.classList.add('collapsed-sidebar');
        updateToggleIcon(true);
    }
    initApp();
    setupEntryForm();
});

async function initApp() { 
    applyTheme();
    
    try {
        // 1. Load data user dulu (tunggu sampai selesai)
        if (state.role === 'Admin') {
            await loadUserDataSelf(); 
            fetchAllUsersAndBulkCache();
        } else {
            await loadUserDataSelf();
        }

        // 2. Setelah data didapat, BARU render sidebar & dashboard
        renderSidebar();
        
        document.getElementById('welcomeText').innerText = `${t('welcome')}, ${userData.name}! 👋`;
        document.getElementById('topRoleBadge').innerText = state.role;
        document.getElementById('topRoleBadge').className = `badge-role ${state.role === 'Admin' ? 'admin-pill' : 'user-pill'}`;
        document.getElementById('langTop').value = state.lang;
        
        if (userData.picture) document.getElementById('userPic').src = userData.picture;
        
        if (state.role === 'Admin') {
            const rs = document.getElementById('roleSelect');
            if(rs) rs.value = state.role;
            fetchUsersToTable(); 
        }
        
        showPage('dashboard');
        checkSimulationStatus();

    } catch (error) {
        console.error("Init App Error:", error);
    } finally {
        // 3. APA PUN YANG TERJADI (berhasil/gagal), hilangkan loading screen
        hideLoading();
    }
}



async function loadUserDataSelf() {
    // Set unit kerja dari data login yang sudah ada di sessionStorage
    if (userData.pbj) {
        state.unitKerja = userData.pbj.toString().trim().toUpperCase();
    }

    // Sisanya tetap sama (ambil profil pak, training, dll)
    if (!getCachedProfile(viewingEmail)) {
        try {
            const res = await fetch(`${API_URL}?action=getProfile&email=${viewingEmail}`);
            const result = await res.json();
            if (result.status === "success") {
                setCachedProfile(viewingEmail, result.data);
                renderDashboardCards();
            }
        } catch (e) { console.error("Failed to load self profile", e); }
    } else {
        renderDashboardCards();
    }
}

// ==========================================
// 5. NAVIGATION & SIDEBAR
// ==========================================
// script.js
// script.js
function renderSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (!menu) return;

    const isAdmin = state.role === 'Admin';
    const unit = state.unitKerja;
    const canSeeUsulan = isAdmin || unit === 'UKPBJ';


    menu.innerHTML = `
        <a class="nav-link" id="nav-dashboard" onclick="showPage('dashboard')"><i class="bi bi-house-door-fill"></i> <span>${t('nav_dash')}</span></a>
        
        <div class="nav-item">
            <a class="nav-link d-flex align-items-center" id="nav-profile" onclick="toggleSub('subProfil')">
                <i class="bi bi-person-circle"></i> <span>${t('nav_profile')}</span><i class="bi bi-chevron-down ms-auto small"></i>
            </a>
            <div id="subProfil" class="submenu shadow-sm" style="display:none">
                <a href="javascript:void(0)" id="sub-pak" onclick="loadProfileData('pak')">${t('sub_pak')}</a>
                <a href="javascript:void(0)" id="sub-training" onclick="loadProfileData('training')">${t('sub_training')}</a>
                <a href="javascript:void(0)" id="sub-experience" onclick="loadProfileData('experience')">${t('sub_experience')}</a>
            </div>
        </div>

        ${canSeeUsulan ? `
            <a class="nav-link" id="nav-entry" onclick="showPage('entry')"><i class="bi bi-plus-circle-fill"></i> <span>${t('nav_entry')}</span></a>
        ` : ''}

        ${isAdmin ? `
            <a class="nav-link" id="nav-analitik" onclick="showAnalitikDev()"><i class="bi bi-bar-chart-fill"></i> <span>${t('nav_analitik')}</span></a>
            <a class="nav-link" id="nav-pengguna" onclick="showPage('pengguna')"><i class="bi bi-people-fill"></i> <span>${t('nav_pengguna')}</span></a>
            <a class="nav-link" id="nav-pengaturan" onclick="showPage('pengaturan')"><i class="bi bi-gear-fill"></i> <span>${t('nav_set')}</span></a>
        ` : ''}
    `;
}


function showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`page-${id}`);
    if(target) target.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${id}`);
    if(activeNav) activeNav.classList.add('active');

    if (id === 'entry') autoFillUsulanForm();
    if (id === 'dashboard') {renderDashboardCards();}
    if(window.innerWidth < 992) document.body.classList.remove('sidebar-open');
}

// ==========================================
// 6. ADMIN & PROFILE LOGIC
// ==========================================
async function fetchAllUsersAndBulkCache() {
    // Kita tetap melakukan fetch background untuk kecepatan (cache), 
    // tapi kita tidak perlu lagi mengupdate dropdown UI.
    if (allUsersData.length === 0) {
        try {
            const res = await fetch(`${API_URL}?action=getAllUsers`);
            const result = await res.json();
            if (result.data && result.data.length > 1) {
                const h = result.data[0];
                const namaIdx = h.indexOf('Nama');
                const emailIdx = h.indexOf('Email');
                allUsersData = result.data.slice(1).map(r => ({
                    nama: r[namaIdx], email: r[emailIdx]
                }));
            }
        } catch(e) { return; }
    }

    const uncached = allUsersData.filter(u => !getCachedProfile(u.email));
    if (uncached.length > 0) {
        const fetches = uncached.map(u =>
            fetch(`${API_URL}?action=getProfile&email=${u.email}&requester=${userData.email}`)
                .then(r => r.json())
                .then(result => {
                    if (result.status === "success") setCachedProfile(u.email, result.data);
                }).catch(() => {})
        );
        await Promise.allSettled(fetches);
    }
    renderDashboardCards();
}

function renderProfileSelectorIfAdmin() {
    // 1. Cek apakah role aktif saat ini adalah Admin
    // Jika Anda sedang simulasi jadi User, fungsi ini akan berhenti di sini (sesuai permintaan Anda)
    if (state.role !== 'Admin') {
        console.log("Selector disembunyikan karena role bukan Admin.");
        return;
    }

    const profileSection = document.getElementById('page-profile');
    if (!profileSection) return;

    let wrap = document.getElementById('profilePageSelector');

    // 2. Jika wrapper belum ada di DOM, buat baru
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'profilePageSelector';
        wrap.className = 'mb-4 p-3 card border-0 shadow-sm d-flex flex-row align-items-center gap-3';
        wrap.style.cssText = 'border-radius:14px; max-width:850px; margin:0 auto 16px auto;';
        wrap.innerHTML = `
            <i class="bi bi-person-lines-fill fs-4 text-primary"></i>
            <div class="flex-grow-1">
                <label class="form-label small fw-bold mb-1 text-muted" style="letter-spacing:0.5px;">LIHAT PROFIL USER</label>
                <select id="adminProfileSelect" class="form-select form-select-sm" style="border-radius:8px;"></select>
            </div>
            <button class="btn btn-primary btn-sm fw-bold px-4" style="border-radius:10px; white-space:nowrap;" onclick="adminSwitchUser(document.getElementById('adminProfileSelect').value)">
                <i class="bi bi-eye-fill me-1"></i> Lihat
            </button>
        `;
        const detailArea = document.getElementById('profileDetailArea');
        if (detailArea) {
            profileSection.insertBefore(wrap, detailArea);
        }
    }

    // 3. Update isi dropdown (Options)
    const sel = document.getElementById('adminProfileSelect');
    if (!sel) return;

    if (allUsersData.length > 0) {
        // Jika data user sudah ada
        sel.innerHTML = allUsersData.map(u => 
            `<option value="${u.email}" ${u.email === viewingEmail ? 'selected' : ''}>${u.nama}</option>`
        ).join('');
    } else {
        // Jika data user belum selesai di-fetch, tampilkan loading/nama sendiri
        sel.innerHTML = `<option value="${userData.email}" selected>Memuat daftar user...</option>`;
    }
}

async function loadProfileData(type) {
    showPage('profile');
    const area = document.getElementById('profileDetailArea');
    document.querySelectorAll('.submenu a').forEach(a => a.classList.remove('active'));
    document.getElementById(`sub-${type}`)?.classList.add('active');
    document.getElementById('nav-profile').classList.add('active');

    const cached = getCachedProfile(viewingEmail);
    if (!cached) {
        area.innerHTML = `<div class="p-5 text-center"><div class="spinner-border text-primary"></div><p class="mt-2">${t('loading')}</p></div>`;
        try {
            const res = await fetch(`${API_URL}?action=getProfile&email=${viewingEmail}&requester=${userData.email}`);
            const result = await res.json();
            if (result.status === "success") setCachedProfile(viewingEmail, result.data);
            else { area.innerHTML = `<div class="alert alert-warning">Data tidak ditemukan.</div>`; return; }
        } catch(e) { area.innerHTML = `<div class="alert alert-danger">Koneksi gagal.</div>`; return; }
    }
    renderProfileUI(type);
}

function renderProfileUI(type) {
    const area = document.getElementById('profileDetailArea');
    const profileData = getCachedProfile(viewingEmail);
    const specificData = profileData ? profileData[type] : null;
    const d = (specificData && specificData.values) ? specificData.values : [];
    const fieldsToShow = customProfileFields[type] || [];

    let labelExtra = type === 'training' ? `
    <div class="p-3 border-bottom">
    <h5 class="fw-800 mb-0" style="font-size: 1.25rem; color: var(--text-main) !important;">
    <i class="bi bi-award-fill me-2 text-success"></i>Keikutsertaan Pelatihan dan Uji Kompetensi
    </h5>
    </div>` : "";

    let html = `
        <div class="card border-0 shadow-sm overflow-hidden mb-4" style="border-radius:20px;">
            <div class="card-header bg-primary text-white p-4 border-0">
                <h5 class="mb-0 fw-bold text-uppercase">${t('sub_' + type)}</h5>
                <small class="opacity-75">${viewingName}</small>
            </div>
            <div class="card-body p-0">${labelExtra}<div class="list-group list-group-flush">`;

    fieldsToShow.forEach(item => {
        if (item.section) {
            html += `<div class="bg-light p-2 px-3 fw-bold small text-primary border-bottom border-top" style="letter-spacing:1px; font-size: 16px;">
                        <i class="bi bi-layers-fill me-1"></i> ${item.section.toUpperCase()}
                     </div>`;
            item.fields.forEach(f => { html += renderRow(f.label, d[f.idx]); });
        } else {
            html += renderRow(item.label, d[item.idx]);
        }
    });

    area.innerHTML = html + `</div></div></div><p class="text-center text-muted small">Update: 2026</p>`;
}

function renderRow(label, value) {
    return `<div class="list-group-item p-3 border-light border-0 border-bottom">
                <div class="row align-items-center">
                    <div class="col-5 text-muted fw-bold text-uppercase" style="font-size:13px; letter-spacing: 0.5px;">${label}</div>
                    <div class="col-7 fw-bold" style="font-size:15px; color: var(--text-main)!important;">${formatTanggal(value)}</div>
                </div>
            </div>`;
}

function adminSwitchUser(email) {
    if (!email) return;
    const user = allUsersData.find(u => u.email === email) || { nama: userData.name, email };
    viewingEmail = email;
    viewingName = user.nama;
    const activeSub = document.querySelector('.submenu a.active');
    const activeType = activeSub ? activeSub.id.replace('sub-', '') : 'pak';
    loadProfileData(activeType);
}

// ==========================================
// 7. ENTRY FORM LOGIC (FIXED REDUNDANCY)
// ==========================================
function setupEntryForm() {
    const form = document.getElementById('entryForm');
    const inputNama = document.getElementById('entNama');
    if(inputNama) inputNama.value = userData.name;

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitForm');
            const statusDiv = document.getElementById('entStatus');

            // DATA SUBMIT: Gabungkan semua kolom (Termasuk yang kondisional)
            const dataToSubmit = [
                new Date().toLocaleString('id-ID'),                                // A: Timestamp
                userData.email,                                                   // B: Email
                userData.name,                                                    // C: Nama
                document.getElementById('entNip').value,                         // D: NIP
                document.querySelector('input[name="entUbahPangkat"]:checked').value, // E: Perubahan Pangkat
                document.getElementById('entLinkSkPangkat').value || "-",          // F: Link SK Pangkat
                document.querySelector('input[name="entAdaAk"]:checked').value,    // G: Ada AK sd 2024
                document.getElementById('entPredikat2023').value || "-",           // H: Predikat 2023
                document.getElementById('entLink2023').value || "-",              // I: Link 2023
                document.getElementById('entPredikat2024').value || "-",           // J: Predikat 2024
                document.getElementById('entLink2024').value || "-",              // K: Link 2024
                document.getElementById('entPredikat').value,                     // L: Predikat 2025
                document.getElementById('entLinkFile').value                      // M: Link 2025
            ];

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

            try {
                const encodedData = encodeURIComponent(JSON.stringify(dataToSubmit));
                const res = await fetch(`${API_URL}?action=addEntry&sheet=Usulan+AK&data=${encodedData}`);
                const result = await res.json();

                if (result.status === "success") {
                    statusDiv.innerHTML = `<div class="card border-0 shadow-sm p-5 text-center mt-3"><i class="bi bi-check-circle-fill fs-1 text-success mb-3"></i><h4>Sukses!</h4><p>Jawaban Anda telah direkam.</p><button onclick="location.reload()" class="btn btn-primary btn-sm px-4">Kirim Lainnya</button></div>`;
                    form.style.display = 'none';
                } else {
                    alert("Gagal: " + (result.message || "Terjadi kesalahan"));
                }
            } catch (err) { 
                console.error(err);
                alert("Error koneksi ke server."); 
            } finally { 
                btn.disabled = false; 
                btn.innerHTML = 'Submit'; 
            }
        });
    }
}

// Conditional Form Helpers
function togglePangkatConditional(val) {
    const area = document.getElementById('pangkatConditionalArea');
    const input = document.getElementById('entLinkSkPangkat');
    area.style.display = (val === 'Ya') ? 'block' : 'none';
    input.required = (val === 'Ya');
    if (val !== 'Ya') input.value = "";
}

function toggleConditionalQuestions(val) {
    const div = document.getElementById('conditionalQuestions');
    const isNeeded = (val === 'Belum ada');
    div.style.display = isNeeded ? 'block' : 'none';
    
    ['entPredikat2023', 'entLink2023', 'entPredikat2024', 'entLink2024'].forEach(id => {
        document.getElementById(id).required = isNeeded;
    });
}

async function autoFillUsulanForm() {
    const inputNip = document.getElementById('entNip');
    if (!inputNip) return;

    const cached = getCachedProfile(userData.email);
    if (cached && cached.pak?.values) {
        inputNip.value = cached.pak.values[2] || "";
    } else {
        try {
            const res = await fetch(`${API_URL}?action=getProfile&email=${userData.email}`);
            const result = await res.json();
            if (result.status === "success") {
                setCachedProfile(userData.email, result.data);
                inputNip.value = result.data.pak.values[3] || "";
            }
        } catch (e) { console.log("Auto-fill NIP failed"); }
    }
}

// ==========================================
// 8. UI HELPERS
// ==========================================
function handleSidebarToggle() { 
    const b = document.body; 
    if (window.innerWidth < 992) {
        b.classList.toggle('sidebar-open'); 
    } else { 
        b.classList.toggle('collapsed-sidebar'); 
        localStorage.setItem('sidebarCollapsed', b.classList.contains('collapsed-sidebar')); 
    } 
}

function updateToggleIcon(isCollapsed) {
    const icon = document.querySelector('.btn-toggle-custom i');
    if(icon) icon.className = isCollapsed ? 'bi bi-list fs-3' : 'bi bi-text-indent-left fs-3';
}

function applyTheme() { 
    document.body.classList.toggle('dark', state.theme === 'dark'); 
    const themeIcon = document.querySelector('#themeBtn i');
    if(themeIcon) themeIcon.className = state.theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars'; 
}

function toggleTheme() { state.theme = state.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('theme', state.theme); applyTheme(); }
function changeLang(v) { localStorage.setItem('lang', v); location.reload(); }
function logout() { sessionStorage.clear(); window.location.href = 'login.html'; }
function saveAdminSettings() { sessionStorage.setItem('activeRole', document.getElementById('roleSelect').value); location.reload(); }

function checkSimulationStatus() {
    const btnBack = document.getElementById('btnBackToAdmin');
    if (btnBack) btnBack.style.display = (userData.role === 'Admin' && state.role === 'User') ? 'inline-block' : 'none';
}

function backToAdmin() {
    sessionStorage.setItem('activeRole', 'Admin');
    window.location.reload();
}

async function fetchUsersToTable() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`${API_URL}?action=getAllUsers&email=${userData.email}`);
        const result = await res.json();
        
        if (result.status === "success" && result.data) {
            const h = result.data[0];
            
            // 1. Cari index kolom secara dinamis agar jika urutan di sheet berubah, kode tetap jalan
            const namaIdx = h.indexOf('Nama');
            const emailIdx = h.indexOf('Email');
            const roleIdx = h.indexOf('Role');
            const unitIdx = h.indexOf('PBJ'); 

            // 2. Mapping data ke dalam baris tabel
            tbody.innerHTML = result.data.slice(1).map(r => `
                <tr>
                    <td><b>${r[namaIdx] || '-'}</b></td>
                    <td>${r[emailIdx] || '-'}</td>
                    <td>
                        <span class="badge-role ${r[roleIdx] === 'Admin' ? 'admin-pill' : 'user-pill'}">
                            ${r[roleIdx] || '-'}
                        </span>
                    </td>
                    <td>${unitIdx !== -1 ? (r[unitIdx] || '-') : '-'}</td>
                </tr>
            `).join('');
        }
    } catch (e) { 
        console.error("Gagal fetch user ke tabel:", e);
    }
}

function renderDashboardCards() {
    const profileData = getCachedProfile(userData.email);
    if (!profileData) {
        console.log("Dashboard: Data belum ada di cache, memulai fetching...");
        loadUserDataSelf(); 
        return;
    }
    
    const d = profileData.pak.values;
    const dashFields = { 
        'dash-ak-pengangkatan': 23, 
        'dash-ak-dasar': 24, 
        'dash-ak-dupak': 25, 
        'dash-ak-integrasi': 26, 
        'dash-predikat-2023': 29,  
        'dash-predikat-2024': 35, 
        'dash-akumulasi-2024': 39, 
        'dash-predikat-2025': 44, 
        'dash-akumulasi-2025': 48,
        'dash-masa-penilaian-2026': 52, 
        'dash-predikat-2026': 53, 
        'dash-konversi-2026': 56,
        'dash-akumulasi-2026': 57 
    };

    for (const [elId, idx] of Object.entries(dashFields)) {
        const el = document.getElementById(elId);
        if (el) {
            let val = d[idx];

            // 1. Logika Khusus untuk Label Masa Penilaian
            if (elId === 'dash-masa-penilaian-2026') {
                // Jika ada isinya, buat format: *Masa Penilaian 2026: Januari - Maret
                // Jika kosong, jangan tampilkan apa-apa
                el.textContent = val ? `*Masa Penilaian 2026: ${val}` : '';
                continue; // Lanjut ke elemen berikutnya
            }

            // 1. Cek apakah data ada (tidak null, tidak undefined, tidak string kosong)
            if (val !== null && val !== undefined && val !== '') {
                
                // 2. Jika datanya adalah angka, lakukan pembulatan 2 desimal
                if (!isNaN(parseFloat(val))) {
                    val = parseFloat(val).toFixed(2);
                } 
                // 3. Jika datanya adalah teks (seperti "Baik"), biarkan apa adanya
                else {
                    val = val.toString();
                }

            } else {
                // 4. Jika data kosong, set ke strip
                val = '—';
            }

            // 5. TAMPILKAN ke elemen (Baris ini harus di luar blok IF angka agar teks tetap muncul)
            el.textContent = val;
        }
    }
}

function showAnalitikDev() { 
    showPage('analitik'); 
    document.getElementById('analitikDataDisplay').innerHTML = `<div class="alert alert-info p-5 text-center" style="border-radius:20px"><h4>${t('nav_analitik')}</h4>${t('dev_mode')}</div>`; 
}

function toggleSub(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.classList.add('fade-out');
    }
}