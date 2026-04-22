// CONFIGURATION
const GOOGLE_CLIENT_ID = "545994110940-n5dm8uc1beho1pn26giphg9b7ij3r7tl.apps.googleusercontent.com";
const API_URL = "https://script.google.com/macros/s/AKfycbyrNYayEmkh4XMHCiRQ951Oz56atgA4bLgHqIvZpp7Vj9fXzDBqlmunpmUS7Lzevvg/exec";

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

async function handleCredentialResponse(response) {
    const payload = decodeJwtResponse(response.credential);
    document.getElementById('buttonDiv').innerHTML = '<div class="verifying-text">Memverifikasi...</div>';

    try {
        const res    = await fetch(`${API_URL}?action=checkUser&email=${payload.email}`);
        const result = await res.json();

        if (result.status === "success") {
            sessionStorage.setItem('isLoggedIn', 'true');
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

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}