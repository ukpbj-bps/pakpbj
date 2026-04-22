// CONFIGURATION
const GOOGLE_CLIENT_ID = "545994110940-n5dm8uc1beho1pn26giphg9b7ij3r7tl.apps.googleusercontent.com"; 
const API_URL = "https://script.google.com/macros/s/AKfycbyfnISwKJILln5e3X_x4ykO8aNUrHz9T9U-KMDCHY01qTUY0l9l6M-Gq0bMfbggDoBT/exec";


// Load Google Sign-In button
window.onload = function () {
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
        document.getElementById("buttonDiv"),
        { theme: "outline", size: "large", width: "300" } 
    );

   
}

// Handle login response
async function handleCredentialResponse(response) {
    // [SEC-1] Simpan raw idToken — dikirim ke backend untuk diverifikasi di sana
    const idToken = response.credential;
    const payload = decodeJwtResponse(idToken); // hanya untuk ambil nama/foto di frontend
 
    document.getElementById('buttonDiv').innerHTML = '<div class="verifying-text">Memverifikasi...</div>';
 
    try {
        // [SEC-1] Kirim idToken ke backend, bukan hanya email
        const res = await fetch(`${API_URL}?action=checkUser&idToken=${encodeURIComponent(idToken)}`);
        const result = await res.json();
 
        if (result.status === "success") {
            // Simpan idToken di sessionStorage untuk dipakai request berikutnya
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('idToken', idToken);
            sessionStorage.setItem('userData', JSON.stringify({
                name   : result.nama,
                email  : payload.email,
                role   : result.role,
                picture: payload.picture,
                pbj    : result.pbj,
                pdf    : result.pdf
            }));
            window.location.href = 'index.html';
        } else {
            document.getElementById('loginStatus').innerText = result.message || "Email Anda tidak terdaftar!";
            document.getElementById('loginStatus').style.display = 'block';
            setTimeout(() => location.reload(), 3000);
        }
    } catch (e) {
        alert("Server sedang sibuk atau URL API salah.");
    }
}

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
}

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].replace(/"/g, '').split(',');
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        let obj = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i]?.replace(/"/g, '').trim());
        return obj;
    });
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}