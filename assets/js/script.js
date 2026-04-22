/**
 * SCRIPT.JS - PROYEK PAK PBJ BPS 2026
 * Versi: Linear Flow & SubMenu Fixed
 */

// ==========================================
// 1. KONFIGURASI & DATA PENGGUNA
// ==========================================
// Tambahkan default pbj dan pdf agar tidak error saat pertama load
const userData = JSON.parse(sessionStorage.getItem('userData')) || { role: 'User', name: 'Guest', email: '', picture: '', pbj: '', pdf: '' };
const API_URL = "https://script.google.com/macros/s/AKfycbyrNYayEmkh4XMHCiRQ951Oz56atgA4bLgHqIvZpp7Vj9fXzDBqlmunpmUS7Lzevvg/exec";

let state = {
    role: sessionStorage.getItem('activeRole') || userData.role,
    lang: localStorage.getItem('lang') || 'id',
    theme: localStorage.getItem('theme') || 'light',
    unitKerja: '' // Akan diisi saat loadUserDataSelf
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
        nav_dash: "Beranda", nav_profile: "Profil", nav_analitik: "Analitik", nav_set: "Pengaturan", nav_entry: "Usulan AK",
        sub_pak: "Data pribadi", sub_training: "Pelatihan dan Ujikom", sub_experience: "Pengalaman", 
        welcome: "Selamat Datang", loading: "Memuat data...", dev_mode: "Fitur masih dalam pengembangan", btn_save: "Simpan"
    },
    en: { 
        nav_dash: "Home", nav_profile: "Profile", nav_analitik: "Analytics", nav_set: "Settings", nav_entry: "Usulan AK",
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

const pic = document.getElementById('userPic');
if (userData.picture) {
    pic.src = userData.picture;
    pic.onerror = () => { pic.src = 'assets/img/default-avatar.png'; };
}
    
// ==========================================
// 3. KONFIGURASI KOLOM (MAPPING)
// ==========================================
const customProfileFields = {
    pak: [
        { idx: 1, label: "Nama Lengkap" }, { idx: 2, label: "NIP" }, { idx: 3, label: "Nomor Karpeg" },
        { idx: 4, label: "Golongan" }, { idx: 5, label: "Pangkat" },{ idx: 6, label: "TMT Pangkat" },{ idx: 7, label: "Tempat Lahir" },{ idx: 8, label: "Tanggal Lahir" }, { idx: 9, label: "Jenis Kelamin" },{ idx: 11, label: "Unit Kerja"},
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
        { section: "Portofolio", fields: [{ idx: 6, label: "Portofolio Madya JK" }] }
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

// FUNGSI UTAMA: Mengatur urutan Load Data -> Render -> Hilangkan Loading
async function initApp() {
    applyTheme();
    
    try {
        // 1. AMBIL DATA TERLEBIH DAHULU (AWAIT)
        if (state.role === 'Admin') {
            await loadUserDataSelf(); 
            fetchAllUsersAndBulkCache();
        } else {
            await loadUserDataSelf();
        }

        // 2. ISI DATA DASHBOARD (Sambil masih loading screen)
        renderDashboardCards();

        // 3. RENDER SIDEBAR (state.unitKerja sudah terisi, jadi menu UKPBJ pasti muncul jika benar)
        renderSidebar();
        
        // 4. UPDATE UI HEADER
        document.getElementById('welcomeText').innerText = `${t('welcome')}, ${userData.name}! 👋`;
        document.getElementById('topRoleBadge').innerText = state.role;
        document.getElementById('topRoleBadge').className = `badge-role ${state.role === 'Admin' ? 'admin-pill' : 'user-pill'}`;
        document.getElementById('langTop').value = state.lang;
        
       if (userData.picture) {
    const pic = document.getElementById('userPic');
    pic.src = userData.picture;
    pic.onerror = () => {
        pic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=16a34a&color=fff&rounded=true`;
    };
}
        
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
        // 5. HILANGKAN LOADING SCREEN PALING TERAKHIR
        hideLoading();
    }
}

async function loadUserDataSelf() {
    // Set unit kerja dari session login
    if (userData.pbj) {
        state.unitKerja = userData.pbj.toString().trim().toUpperCase();
    }

    if (!getCachedProfile(viewingEmail)) {
        try {
            const res = await fetch(`${API_URL}?action=getProfile&email=${viewingEmail}`);
            const result = await res.json();
            if (result.status === "success") {
                setCachedProfile(viewingEmail, result.data);
            }
        } catch (e) { console.error("Failed to load self profile", e); }
    }
}

// ==========================================
// 5. NAVIGATION & SIDEBAR
// ==========================================
function renderSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (!menu) return;

    const isAdmin = state.role === 'Admin';
    const canSeeUsulan = isAdmin || state.unitKerja === 'UKPBJ';

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
            <div class="nav-item">
                <a class="nav-link d-flex align-items-center" id="nav-entry" onclick="toggleSub('subEntry')">
                    <i class="bi bi-plus-circle-fill"></i> <span>${t('nav_entry')}</span><i class="bi bi-chevron-down ms-auto small"></i>
                </a>
                <div id="subEntry" class="submenu shadow-sm" style="display:none">
                    <a href="javascript:void(0)" onclick="showPage('entry-form')">Form Usulan AK</a>
                    <a href="javascript:void(0)" onclick="showPage('entry-pdf')">Draf Penetapan AK</a>
                </div>
            </div>
        ` : ''}

        ${isAdmin ? `
            <a class="nav-link" id="nav-analitik" onclick="showAnalitikDev()"><i class="bi bi-bar-chart-fill"></i> <span>${t('nav_analitik')}</span></a>
            <a class="nav-link" id="nav-pengaturan" onclick="showPage('pengaturan')"><i class="bi bi-gear-fill"></i> <span>${t('nav_set')}</span></a>
        ` : ''}
    `;
}

function showPage(id) {
    // 1. Tampilkan halaman yang dituju
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`page-${id}`);
    if(target) target.style.display = 'block';

    // 2. FORCE RESET: Hapus SEMUA highlight di sidebar tanpa terkecuali
    // Ini memastikan tidak ada menu yang "tertinggal" status active-nya
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('.submenu a').forEach(el => {
        el.classList.remove('active');
    });

    // 3. LOGIKA HIGHLIGHT MENU UTAMA (Hanya untuk menu tunggal)
    // Kita hanya izinkan menu-menu ini untuk menjadi hijau
    const allowedSingleMenus = ['dashboard', 'pengaturan', 'analitik'];
    
    if (allowedSingleMenus.includes(id)) {
        const navEl = document.getElementById(`nav-${id}`);
        if (navEl) navEl.classList.add('active');
    }

    // 4. HIGHLIGHT KHUSUS SUB-MENU USULAN AK
    if (id.startsWith('entry-')) {
        if(id === 'entry-form') {
            const link = Array.from(document.querySelectorAll('#subEntry a')).find(a => a.innerText.includes('Form Usulan AK'));
            if(link) link.classList.add('active');
        } else if(id === 'entry-pdf') {
            const link = Array.from(document.querySelectorAll('#subEntry a')).find(a => a.innerText.includes('Draf Penetapan AK'));
            if(link) link.classList.add('active');
        }
    }

    // 5. TRIGGER FUNGSI HALAMAN
    if (id === 'entry-form') autoFillUsulanForm();
    if (id === 'entry-pdf') loadUserPDF(); 
    if (id === 'dashboard') renderDashboardCards();
    
    if(window.innerWidth < 992) document.body.classList.remove('sidebar-open');
}

// ==========================================
// 6. ADMIN & PROFILE LOGIC
// ==========================================
async function fetchAllUsersAndBulkCache() {
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
    if (state.role !== 'Admin') return;
    const profileSection = document.getElementById('page-profile');
    if (!profileSection) return;

    let wrap = document.getElementById('profilePageSelector');
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
        if (detailArea) profileSection.insertBefore(wrap, detailArea);
    }

    const sel = document.getElementById('adminProfileSelect');
    if (!sel) return;
    if (allUsersData.length > 0) {
        sel.innerHTML = allUsersData.map(u => `<option value="${u.email}" ${u.email === viewingEmail ? 'selected' : ''}>${u.nama}</option>`).join('');
    } else {
        sel.innerHTML = `<option value="${userData.email}" selected>Memuat daftar user...</option>`;
    }
}

async function loadProfileData(type) {
    // Panggil showPage untuk mengganti konten halaman
    showPage('profile'); 
    
    // PENGAMAN EKSTRA: Pastikan sekali lagi nav-profile TIDAK active
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) {
        navProfile.classList.remove('active');
    }

    const area = document.getElementById('profileDetailArea');
    
    // Hapus highlight dari semua sub-menu profil sebelum memberikan yang baru
    document.querySelectorAll('#subProfil a').forEach(a => a.classList.remove('active'));
    
    // Berikan highlight hanya pada sub-menu yang diklik
    const subLink = document.getElementById(`sub-${type}`);
    if(subLink) {
        subLink.classList.add('active');
    }

    // --- Sisa kode loading data Anda ---
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

    let labelExtra = type === 'training' ? `<div class="p-3 border-bottom"><h6 class="fw-800 mb-0"><i class="bi bi-award-fill me-2 text-success"></i>Keikutsertaan Pelatihan dan Uji Kompetensi</h6></div>` : "";

    let html = `<div class="card border-0 shadow-sm overflow-hidden mb-4" style="border-radius:20px;"><div class="card-header bg-primary text-white p-4 border-0"><h5 class="mb-0 fw-bold text-uppercase">${t('sub_' + type)}</h5><small class="opacity-75">${viewingName}</small></div><div class="card-body p-0">${labelExtra}<div class="list-group list-group-flush">`;

    fieldsToShow.forEach(item => {
        if (item.section) {
            html += `<div class="bg-light p-2 px-3 fw-bold small text-primary border-bottom border-top" style="letter-spacing:1px; font-size: 11px;"><i class="bi bi-layers-fill me-1"></i> ${item.section.toUpperCase()}</div>`;
            item.fields.forEach(f => { html += renderRow(f.label, d[f.idx]); });
        } else {
            html += renderRow(item.label, d[item.idx]);
        }
    });

    area.innerHTML = html + `</div></div></div><p class="text-center text-muted small">Update: 2026</p>`;
}

function renderRow(label, value) {
    return `<div class="list-group-item p-3 border-light border-0 border-bottom"><div class="row align-items-center"><div class="col-5 text-muted fw-bold text-uppercase" style="font-size:13px; letter-spacing: 0.5px;">${label}</div><div class="col-7 fw-bold" style="font-size:15px; color: var(--text-main)!important;">${formatTanggal(value)}</div></div></div>`;
}

function adminSwitchUser(email) {
    if (!email) return;
    const user = allUsersData.find(u => u.email === email) || { nama: userData.name, email };
    viewingEmail = email; viewingName = user.nama;
    const activeSub = document.querySelector('.submenu a.active');
    const activeType = activeSub ? activeSub.id.replace('sub-', '') : 'pak';
    loadProfileData(activeType);
}

// ==========================================
// 7. ENTRY FORM LOGIC
// ==========================================
// --- BAGIAN 7: ENTRY FORM (UPDATE POPUP & HAPUS TOMBOL KIRIM LAINNYA) ---
function setupEntryForm() {
    const form = document.getElementById('entryForm');
    const inputNama = document.getElementById('entNama');
    if(inputNama) inputNama.value = userData.name;
     if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // POP UP KONFIRMASI (TENGAH)
            const confirm = await Swal.fire({
                title: 'Kirim Usulan?',
                text: "Pastikan data sudah benar sebelum dikirim.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Kirim',
                cancelButtonText: 'Cek Kembali',
                reverseButtons: true
            });

            if (!confirm.isConfirmed) return;

            // TAMPILKAN LOADING
            Swal.fire({
                title: 'Sedang memproses...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const dataToSubmit = [
                new Date().toLocaleString('id-ID'), userData.email, userData.name,
                document.getElementById('entNip').value,
                document.querySelector('input[name="entUbahPangkat"]:checked').value,
                document.getElementById('entLinkSkPangkat').value || "-",
                document.querySelector('input[name="entAdaAk"]:checked').value,
                document.getElementById('entPredikat2023').value || "-",
                document.getElementById('entLink2023').value || "-",
                document.getElementById('entPredikat2024').value || "-",
                document.getElementById('entLink2024').value || "-",
                document.getElementById('entPredikat').value,
                document.getElementById('entLinkFile').value
            ];

            try {
                const encodedData = encodeURIComponent(JSON.stringify(dataToSubmit));
                const res = await fetch(`${API_URL}?action=addEntry&email=${userData.email}&sheet=Usulan+AK&data=${encodedData}`);
                const result = await res.json();

                if (result.status === "success") {
                    Swal.fire('Berhasil!', 'Usulan Anda telah direkam.', 'success');
                    document.getElementById('entStatus').innerHTML = `
                        <div class="card border-0 shadow-sm p-5 text-center mt-3" style="border-radius:20px;">
                            <i class="bi bi-check-circle-fill fs-1 text-success mb-3"></i>
                            <h4 class="fw-800">Terima Kasih!</h4>
                            <p class="text-muted">Jawaban Anda telah direkam ke dalam sistem.</p>
                        </div>`;
                    form.style.display = 'none';
                } else {
                    // POP UP GAGAL/DUPLIKAT (TENGAH)
                    Swal.fire('Gagal', result.message, 'warning');
                }
            } catch (err) {
                Swal.fire('Error', 'Kesalahan koneksi server.', 'error');
            }
        });
    }
}

// --- BAGIAN PDF: LOCK 1 KALI ENTRI ---

// Fungsi yang dipanggil saat user buka menu PDF
async function loadUserPDF() {
    const viewer = document.getElementById('pdfViewer');
    const actionArea = document.getElementById('verifActionArea');
    const doneArea = document.getElementById('verifDoneArea');
    const instruction = document.getElementById('verifInstruction');

    // Tampilkan PDF
    const pdfUrlRaw = userData.pdf;
    if (pdfUrlRaw && pdfUrlRaw.includes('drive.google.com')) {
        const match = pdfUrlRaw.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) viewer.src = `https://drive.google.com/file/d/${match[1]}/preview`;
    }

    // CEK STATUS KE SERVER (Kunci permanen jika sudah ada data)
    try {
        const res = await fetch(`${API_URL}?action=addEntry&email=${userData.email}&sheet=Verifikasi+Draf&data=[]`);
        const result = await res.json();
        
        if (result.message && result.message.includes("sudah melakukan verifikasi")) {
            actionArea.style.display = 'none';
            instruction.style.display = 'none';
            doneArea.style.display = 'block';
        } else {
            actionArea.style.display = 'block';
            instruction.style.display = 'block';
            doneArea.style.display = 'none';
        }
    } catch (e) {
        actionArea.style.display = 'block';
    }
}

async function submitVerifikasi(status) {
    let catatan = "-";
    if (status === 'Belum Sesuai') {
        catatan = document.getElementById('verifCatatan').value.trim();
        if (!catatan) {
            Swal.fire('Catatan Kosong', 'Mohon isi alasan ketidaksesuaian.', 'warning');
            return;
        }
    }

    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    const dataToSubmit = [new Date().toLocaleString('id-ID'), userData.email, userData.name, status, catatan];
    
    try {
        const encodedData = encodeURIComponent(JSON.stringify(dataToSubmit));
        const res = await fetch(`${API_URL}?action=addEntry&email=${userData.email}&sheet=Verifikasi+Draf&data=${encodedData}`);
        const result = await res.json();

        if (result.status === "success") {
            Swal.fire('Berhasil!', 'Respon Anda telah disimpan.', 'success');
            document.getElementById('verifActionArea').style.display = 'none';
            document.getElementById('verifDoneArea').style.display = 'block';
        } else {
            Swal.fire('Gagal', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Koneksi gagal.', 'error');
    }
}

function batalVerifikasi() {
    document.getElementById('verifCatatanArea').style.display = 'none';
    document.getElementById('btnSesuai').style.display = 'inline-block';
    document.getElementById('btnBelumSesuai').style.display = 'inline-block';
}

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
    if (window.innerWidth < 992) b.classList.toggle('sidebar-open'); 
    else { 
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
function backToAdmin() { sessionStorage.setItem('activeRole', 'Admin'); window.location.reload(); }

async function fetchUsersToTable() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`${API_URL}?action=getAllUsers&email=${userData.email}`);
        const result = await res.json();
        if (result.status === "success" && result.data) {
            const h = result.data[0];
            const namaIdx = h.indexOf('Nama');
            const emailIdx = h.indexOf('Email');
            const roleIdx = h.indexOf('Role');
            const unitIdx = h.indexOf('PBJ'); 
            tbody.innerHTML = result.data.slice(1).map(r => `
                <tr>
                    <td><b>${r[namaIdx] || '-'}</b></td>
                    <td>${r[emailIdx] || '-'}</td>
                    <td><span class="badge-role ${r[roleIdx] === 'Admin' ? 'admin-pill' : 'user-pill'}">${r[roleIdx] || '-'}</span></td>
                    <td>${unitIdx !== -1 ? (r[unitIdx] || '-') : '-'}</td>
                </tr>`).join('');
        }
    } catch (e) { console.error("Gagal fetch user ke tabel:", e); }
}

function renderDashboardCards() {
    const profileData = getCachedProfile(userData.email);
    if (!profileData) return;
    const d = profileData.pak.values;
    const dashFields = { 
        'dash-ak-pengangkatan': 23, 'dash-ak-dasar': 24, 'dash-ak-dupak': 25, 'dash-ak-integrasi': 26, 
        'dash-predikat-2023': 29, 'dash-konversi-2023': 32, 'dash-predikat-2024': 35, 'dash-akumulasi-2024': 39, 
        'dash-predikat-2025': 44, 'dash-akumulasi-2025': 48
    };
    for (const [elId, idx] of Object.entries(dashFields)) {
        const el = document.getElementById(elId);
        if (el) el.textContent = d[idx] || '—';
    }
}

function showAnalitikDev() { 
    showPage('analitik'); 
    document.getElementById('analitikDataDisplay').innerHTML = `<div class="alert alert-info p-5 text-center" style="border-radius:20px"><h4>${t('nav_analitik')}</h4>${t('dev_mode')}</div>`; 
}

function toggleSub(id) {
    const el = document.getElementById(id);
    // Hanya toggle menu yang diklik, tidak menutup menu lainnya
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function loadUserPDF() {
    const viewer = document.getElementById('pdfViewer');
    const placeholder = document.getElementById('pdfPlaceholder');
    const pdfUrlRaw = userData.pdf;

    if (pdfUrlRaw && pdfUrlRaw.includes('drive.google.com')) {
        // Ekstrak file ID dari berbagai format URL Google Drive
        const match = pdfUrlRaw.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            const fileId = match[1];
            const pdfUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            viewer.src = pdfUrl;
            viewer.style.display = 'block';
            placeholder.classList.add('d-none');
        } else {
            // Fallback: URL drive tapi format tidak dikenali
            viewer.style.display = 'none';
            placeholder.classList.remove('d-none');
        }
    } else {
        viewer.style.display = 'none';
        placeholder.classList.remove('d-none');
    }
}

function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.add('fade-out');
}

function validateLink(inputId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(`error-${inputId}`);
    if (!input) return;

    const val = input.value;
    const isValid = val.startsWith('http://') || val.startsWith('https://');

    if (val !== "" && !isValid) {
        if (errorDiv) errorDiv.style.display = 'block';
        input.classList.add('is-invalid');
    } else {
        if (errorDiv) errorDiv.style.display = 'none';
        input.classList.remove('is-invalid');
    }
}



// FUNGSI UNTUK MENGIRIM VERIFIKASI DRAF
function pilihVerifikasi(status) {
    if (status === 'Sesuai') {
        Swal.fire({
            title: 'Konfirmasi',
            text: "Apakah Anda yakin dokumen sudah sesuai?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Sesuai',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) submitVerifikasi('Sesuai');
        });
    } else {
        document.getElementById('verifCatatanArea').style.display = 'block';
        document.getElementById('btnSesuai').style.display = 'none';
        document.getElementById('btnBelumSesuai').style.display = 'none';
    }
}

function batalVerifikasi() {
    document.getElementById('verifCatatanArea').style.display = 'none';
    document.getElementById('btnSesuai').style.display = '';
    document.getElementById('btnBelumSesuai').style.display = '';
    document.getElementById('verifCatatan').value = '';
}

async function submitVerifikasi(status) {
    let catatan = "-";
    if (status === 'Belum Sesuai') {
        catatan = document.getElementById('verifCatatan').value.trim();
        if (!catatan) {
            Swal.fire('Perhatian', 'Mohon tuliskan bagian yang belum sesuai.', 'warning');
            return;
        }
    }

    // TAMPILKAN LOADING (TENGAH)
    Swal.fire({
        title: 'Menyimpan respon...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const dataToSubmit = [new Date().toLocaleString('id-ID'), userData.email, userData.name, status, catatan];
    
    try {
        const encodedData = encodeURIComponent(JSON.stringify(dataToSubmit));
        const res = await fetch(`${API_URL}?action=addEntry&email=${userData.email}&sheet=Verifikasi+Draf&data=${encodedData}`);
        const result = await res.json();

        if (result.status === "success") {
            Swal.fire('Berhasil!', 'Verifikasi Anda telah disimpan.', 'success');
            document.getElementById('verifActionArea').style.display = 'none';
            document.getElementById('verifInstruction').style.display = 'none';
            document.getElementById('verifDoneArea').style.display = 'block';
        } else {
            Swal.fire('Gagal', result.message, 'warning');
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal menghubungi server.', 'error');
    }
}