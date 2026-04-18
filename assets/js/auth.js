// CONFIGURATION
const GOOGLE_CLIENT_ID = "545994110940-n5dm8uc1beho1pn26giphg9b7ij3r7tl.apps.googleusercontent.com"; 
const API_URL = "https://script.google.com/macros/s/AKfycbyBlSWBI_vbQ1B6EWjrqfnPtHZzyD5pvCQNJOQUEUXgPmLg-d0rXr2xHbV8mx5PY5vN/exec";


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
    const payload = decodeJwtResponse(response.credential);
    document.getElementById('buttonDiv').innerHTML = "Memverifikasi...";

    try {
        // Panggil API Backend untuk cek apakah email ada di GSheet
        const res = await fetch(`${API_URL}?action=checkUser&email=${payload.email}`);
        const result = await res.json();

        if (result.status === "success") {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userData', JSON.stringify({
                name: result.nama,
                email: payload.email,
                role: result.role,
                picture: payload.picture
            }));
            window.location.href = 'index.html';
        } else {
            document.getElementById('loginStatus').innerText = "Email Anda tidak terdaftar!";
            document.getElementById('loginStatus').style.display = 'block';
            setTimeout(() => location.reload(), 3000);
        }
    } catch (e) {
        alert("Server sedang sibuk atau URL API salah.");
    }
}

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
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