// =================== PAGE LOAD LOADER ===================

function hasLoaderBeenShown() {
    return sessionStorage.getItem("abutoys_loader_shown") === "true";
}

function markLoaderAsShown() {
    sessionStorage.setItem("abutoys_loader_shown", "true");
}

function hidePageLoadLoader() {
    const loader = document.getElementById("abutoys-page-loader");
    if (loader) {
        loader.classList.add("fade-out");
        setTimeout(() => {
            loader.classList.add("hidden");
        }, 600);
    }
}

// Start loader immediately on page load
function initializeLoader() {
    if (!hasLoaderBeenShown()) {
        markLoaderAsShown();
        
        // Show loader for 1 second
        setTimeout(() => {
            hidePageLoadLoader();
        }, 2000);
    } else {
        // Hide loader immediately if already shown
        const loader = document.getElementById("abutoys-page-loader");
        if (loader) {
            loader.classList.add("hidden");
        }
    }
}

// Run as soon as DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoader);
} else {
    initializeLoader();
}

function showLocationLoader() {
    const old = document.getElementById("location-loader");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "location-loader";
    wrap.style.cssText = `
        position: fixed;
        top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.7);
        display:flex; align-items:center; justify-content:center;
        z-index:10002;
    `;

    wrap.innerHTML = `
        <div style="text-align:center;">
            <div style="
                border: 6px solid #fff;
                border-top: 6px solid #4ECDC4;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: auto;
            "></div>
            <p style="color:white; margin-top:15px; font-size:1.1rem;">
                Verifying your location…
            </p>
        </div>
    `;

    document.body.appendChild(wrap);
}

function hideLocationLoader() {
    const el = document.getElementById("location-loader");
    if (el) el.remove();
}

// Add CSS (spinner animation)
const style = document.createElement("style");
style.textContent = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}`;
document.head.appendChild(style);


// =================== CLEAR INVALID DATA ===================
try {
    const storedUser = localStorage.getItem("abutoys_current_user");
    if (storedUser === "visitor" || storedUser === "null" || storedUser === null) {
        localStorage.removeItem("abutoys_current_user");
        localStorage.removeItem("abutoys_location_status");
        localStorage.removeItem("abutoys_delivery_charge");
    }
} catch (e) {
    console.log("localStorage not available");
}

// =================== CONFIG ===================
const SHOP_LOCATION = { lat: 23.0370322, lng: 72.5822496 }; // use this if you want exact map pin
const DELIVERY_RANGE_KM = 10;

// ✅ SAME URL FOR BOTH - YAHI ISSUE THA
const SIGNUP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzdP_klBNa_q2YTbF7C07AzXeTcJ7dYudKveZawuCVgfakVA2WQe4gJ4mCmlbiTAJYM-Q/exec";

console.log("🚀 AbuToys Script Loaded");

// ---------- HELPER: Detect if inside an in-app WebView ----------
function isInWebView() {
    const ua = navigator.userAgent || "";
    // crude but works in many cases
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return false;
    // common webview signals
    return /wv|WebView|FBAN|FBAV|Instagram|Line|FB_IAB|Twitter|Pinterest/i.test(ua);
}

// ---------- WRAPPER: Try geolocation, if denied or WebView show fallback ----------
async function verifyOrFallback() {
    // show loader quickly
    try { showLocationLoader(); } catch(e){console.warn("no loader fn", e);}

    // If we're likely inside a WebView, skip native geo attempts and show fallback hint
    if (isInWebView()) {
        console.warn("Running inside WebView, geolocation often blocked.");
        hideLocationLoader();
        showLocationDeniedInstructions(true); // true => show WebView specific hint
        return { status: "permission_denied", fallback: true };
    }

    // Try the robust debug verifier first (it returns normalized statuses)
    let res;
    if (typeof verifyUserLocation_debug === "function") {
        res = await verifyUserLocation_debug();
    } else if (typeof verifyUserLocation === "function") {
        res = await verifyUserLocation();
    } else {
        // fallback if neither present
        try { hideLocationLoader(); } catch(e){}
        showPopup("⚠️ Location feature temporarily unavailable", "warning");
        return { status: "unknown" };
    }

    if (res && res.status === "in_range") {
        // success, UI will handle it
        return res;
    }

    // denied or unknown -> show instructions and fallback UI
    hideLocationLoader();
    if (res && res.status === "permission_denied") {
        showLocationDeniedInstructions(false); // false => browser-specific instructions
    } else {
        // unknown/out_of_range
        showManualLocationModal();
    }
    return res || { status: "unknown" };
}

// ---------- UI: Show instructions when permission denied ----------
function showLocationDeniedInstructions(isWebView) {
    const msg = isWebView
      ? `It looks like you're inside an app's browser (in-app). Geolocation is often disabled there.\n\nOpen this link in Chrome/Safari (tap the three dots → Open in browser) and try again.`
      : `Location permission is blocked for this site.\n\nChrome: tap lock icon → Site settings → Location → Allow.\n\nAfter allowing, refresh the page.`;
    showPopup(msg, "error");
}

// ---------- UI: Manual location modal (simple) ----------
function showManualLocationModal() {
    // create a simple modal overlay if not exists
    if (document.getElementById("abutoys-manual-loc-modal")) {
        document.getElementById("abutoys-manual-loc-modal").style.display = "flex";
        return;
    }

    const modal = document.createElement("div");
    modal.id = "abutoys-manual-loc-modal";
    modal.style = `
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.6);z-index:9999;padding:16px;
    `;
    modal.innerHTML = `
      <div style="width:100%;max-width:420px;background:#fff;border-radius:10px;padding:18px;text-align:left;">
        <h3 style="margin:0 0 8px">Enter your pincode or location</h3>
        <p style="margin:0 0 12px;font-size:13px;color:#333">If browser blocked location, enter your pincode or city so we can check delivery availability.</p>
        <input id="abutoys_manual_pincode" placeholder="Pincode or city name" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:6px" />
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="abutoys_manual_cancel" style="padding:8px 12px;border-radius:6px;background:#eee;border:0">Cancel</button>
          <button id="abutoys_manual_submit" style="padding:8px 12px;border-radius:6px;background:#007bff;color:#fff;border:0">Submit</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("abutoys_manual_cancel").onclick = () => {
        modal.style.display = "none";
    };
    document.getElementById("abutoys_manual_submit").onclick = () => {
        const val = (document.getElementById("abutoys_manual_pincode").value || "").trim();
        if (!val) {
            alert("Please enter pincode or city.");
            return;
        }
        // handle manual value: try to geocode or use pincode mapping
        handleManualLocationValue(val);
        modal.style.display = "none";
    };
}

// ---------- Handler: what to do when user enters manual fallback ----------
async function handleManualLocationValue(val) {
    // naive: if numeric assume pincode -> map to approximate lat/lng if you have dataset
    // For now, just store the manual entry and continue the flow as 'manual' so user can place order
    localStorage.setItem("abutoys_manual_location", val);
    localStorage.setItem("abutoys_location_status", "manual");
    showPopup("Manual location saved. You can continue ordering.", "success");

    // continue the usual UI flow (e.g., show account modal or products)
    if (!userManager.isLoggedIn()) {
        setTimeout(() => showAccountModal(), 700);
    } else {
        // run whatever success handler you have
        // e.g., loadProductsForLocation()
        if (typeof loadProductsForLocation === "function") loadProductsForLocation();
    }
}


// ===== fast + fallback location verification =====
async function verifyUserLocation() {
    showLocationLoader();

    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            hideLocationLoader();
            resolve({ status: "no_geo" });
            return;
        }

        // SIMPLE WORKING OPTIONS
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                hideLocationLoader();

                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;

                const dist = calculateDistance(
                    userLat,
                    userLng,
                    SHOP_LOCATION.lat,
                    SHOP_LOCATION.lng
                );

                const charge = getDeliveryCharge(dist);

                localStorage.setItem("abutoys_user_location", JSON.stringify({ lat: userLat, lng: userLng }));
                localStorage.setItem("abutoys_user_distance", dist.toFixed(2));
                localStorage.setItem("abutoys_delivery_charge", charge);

                if (charge === -1) {
                    localStorage.setItem("abutoys_location_status", "out_of_range");
                    resolve({ status: "out_of_range", distance: dist, charge });
                } else {
                    localStorage.setItem("abutoys_location_status", "in_range");
                    resolve({ status: "in_range", distance: dist, charge });
                }
            },

            // ERROR CALLBACK
            (err) => {
                hideLocationLoader();

                if (err.code === 1) {
                    localStorage.setItem("abutoys_location_status", "permission_denied");
                    resolve({ status: "permission_denied" });
                } else {
                    localStorage.setItem("abutoys_location_status", "unknown");
                    resolve({ status: "unknown" });
                }
            },

            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 0
            }
        );
    });
}


// small helper used above to compute distance/charge & return same shape as original
async function handlePositionAndReturn(coords) {
    const userLat = coords.latitude;
    const userLng = coords.longitude;

    const dist = calculateDistance(userLat, userLng, SHOP_LOCATION.lat, SHOP_LOCATION.lng);

    localStorage.setItem("abutoys_user_location", JSON.stringify({ lat: userLat, lng: userLng }));
    localStorage.setItem("abutoys_user_distance", dist.toFixed(2));

    const charge = getDeliveryCharge(dist);
    localStorage.setItem("abutoys_delivery_charge", charge);

    if (charge === -1) {
        localStorage.setItem("abutoys_location_status", "out_of_range");
        hideLocationLoader();
        return { status: "out_of_range", distance: dist, charge };
    }

    localStorage.setItem("abutoys_location_status", "in_range");
    hideLocationLoader();
    return { status: "in_range", distance: dist, charge };
}

// ------------------ LOCATION VERIFICATION HELPERS (FIXED) ------------------
async function startLocationVerification() {
    // start and return the verification result so callers can use it
    try {
        const result = await verifyUserLocation();

        // Normalize statuses (verifyUserLocation returns in_range / out_of_range / unknown)
        if (result && result.status === "in_range") {
            showPopup(`✅ Location Verified!\nDistance Charge: \n₹${result.charge}`, "success");
        } else if (result && result.status === "out_of_range") {
            showPopup(`❌ You are ${Math.round(result.distance)} km away.\nDelivery not available!`, "error");
        } else if (result && result.status === "permission_denied") {
            showPopup("⚠️ Location Access Denied! Please enable location permissions.", "error");
        } else {
            showPopup("⚠️ Cannot detect location.\nPlease enable GPS & internet.", "warning");
        }

        // always return the raw result object so the caller can make decisions
        return result;
    } catch (err) {
        // In case anything throws, ensure loader is hidden and return unknown
        hideLocationLoader();
        localStorage.setItem("abutoys_location_status", "unknown");
        return { status: "unknown" };
    }
}

async function showWelcomeMessage() {
    const isFirstVisit = !sessionStorage.getItem("abutoys_welcomed");

    if (!isFirstVisit) {
        console.log("ℹ️ Not first visit, skipping welcome");
        return;
    }

    sessionStorage.setItem("abutoys_welcomed", "true");

    let userName = "Guest";
    if (userManager.isLoggedIn()) {
        const user = userManager.getUser(userManager.currentUser);
        if (user) userName = user.fullName;
    }

    console.log("👋 Showing welcome for:", userName);

    showCustomWelcomePopup(userName, async () => {
        // show loader immediately so user sees something while we ask for permission
        showLocationLoader();

        // get the verification result (startLocationVerification now RETURNS it)
        const res = await startLocationVerification();

        // ensure loader hidden (verifyUserLocation also hides, but double-safety is fine)
        hideLocationLoader();

        // Use normalized keys returned by verifyUserLocation
        if (res && res.status === 'in_range') {
            showPopup(`✅ Location Verified!\n\nDistance: ${Number(res.distance).toFixed(2)} km\nDelivery Charge: ₹${res.charge}`, "success");
        }
        else if (res && res.status === 'out_of_range') {
            showPopup(`❌ Sorry!\n\nYou are ${Math.round(res.distance)} km away.\n\nWe don't deliver there.`, "warning");
        }
        else if (res && res.status === 'permission_denied') {
            showPopup(`⚠️ Location Access Denied!\n\nPlease enable your location.`, "error");
        }
        else {
            showPopup(`⚠️ Cannot detect location\n\nPlease check your GPS/internet`, "warning");
        }

        // If not logged in, show signup modal after a small delay
        if (!userManager.isLoggedIn()) {
            setTimeout(() => {
                showAccountModal();
            }, 1500);
        }
    });
}


/* ========== CALCULATE DISTANCE ========== */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI/180;
    const dLon = (lon2 - lon1) * Math.PI/180;
    const a =
        Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) *
        Math.cos(lat2 * Math.PI/180) *
        Math.sin(dLon/2)*Math.sin(dLon/2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ========== DELIVERY CHARGE ========== */
function getDeliveryCharge(d) {
    if (d > 10) return -1;     // ❌ Above 10 km = No delivery
    if (d <= 1) return 0;
    if (d <= 2) return 60;
    if (d <= 3) return 80;
    if (d <= 4) return 100;
    if (d <= 5) return 120;
    if (d <= 6) return 140;
    if (d <= 7) return 160;
    if (d <= 8) return 180;
    if (d <= 9) return 200;
    if (d <= 10) return 220;

    return -1;
}



// =================== USER MANAGER ===================
class UserManager {
    constructor() {
        try {
            this.currentUser = localStorage.getItem("abutoys_current_user");
        } catch (e) {
            this.currentUser = null;
        }
        this.loadCurrentUser();
    }

    getUser(email) {
        try {
            return JSON.parse(localStorage.getItem(`abutoys_user_${email}`) || "null");
        } catch (e) {
            return null;
        }
    }

    isLoggedIn() {
        return this.currentUser && this.currentUser !== "null" && this.currentUser !== "";
    }

    setCurrentUser(email) {
        try {
            localStorage.setItem("abutoys_current_user", email);
        } catch (e) { }
        this.currentUser = email;
        this.updateUserDisplay();
    }

    async register(userData) {
        try {
            showPopup("⏳ Creating your account...", "loading");
            const email = userData.email.toLowerCase().trim();

            const existingUser = this.getUser(email);
            if (existingUser) {
                showPopup("❌ Email already registered!", "error");
                return false;
            }

            const formData = new FormData();
            formData.append('action', 'register');
            formData.append('fullName', userData.fullName);
            formData.append('email', email);
            formData.append('password', userData.password);
            formData.append('phone', userData.phone.replace('+91', ''));
            formData.append('address', userData.address);

            console.log("📤 Sending registration data...", userData);

            const response = await fetch(SIGNUP_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });

            console.log("📥 Response status:", response.status);

            let result;
            try {
                result = await response.json();
            } catch (e) {
                const text = await response.text();
                console.error("❌ Parse error. Response:", text);
                showPopup("❌ Server error! Try again later.", "error");
                return false;
            }

            console.log("✅ Server response:", result);

            if (result.success) {
                // localStorage me save karo
                try {
                    localStorage.setItem(`abutoys_user_${email}`, JSON.stringify(userData));
                } catch (e) { }
                this.setCurrentUser(email);

                // Form close karo
                closeAccountModal();

                // Success message
                showPopup("✅ Account created successfully!\n📧 Check your email for confirmation.", "success");
                console.log("✅ User registered:", userData.fullName);

                // Floating buttons update karo
                updateFloatingButtons();

                return true;
            } else {
                if (result.message === "email_exists") {
                    showPopup("❌ Email already registered!", "error");
                } else {
                    showPopup("❌ " + (result.message || "Registration failed"), "error");
                }
                return false;
            }

        } catch (error) {
            console.error("❌ Registration error:", error);
            showPopup("❌ Network error! Check your connection.", "error");
            return false;
        }
    }

    updateUserDisplay() {
        const userNameDisplay = document.getElementById("userNameDisplay");

        if (!userNameDisplay) return;

        if (this.isLoggedIn()) {
            const user = this.getUser(this.currentUser);
            if (user) {
                userNameDisplay.textContent = `👋 Hello ${user.fullName}!`;
                userNameDisplay.style.display = "block";
                return;
            }
        }

        userNameDisplay.style.display = "none";
    }

    loadCurrentUser() {
        if (this.currentUser) {
            this.updateUserDisplay();
        }
    }

    getCurrentUserName() {
        if (this.isLoggedIn()) {
            const user = this.getUser(this.currentUser);
            return user ? user.fullName : "User";
        }
        return "Guest";
    }
}

// =================== INITIALIZE ===================
const userManager = new UserManager();

// =================== POPUP SYSTEM ===================
function showPopup(message, type = "info") {
    const old = document.getElementById("custom-popup");
    if (old) old.remove();

    const colors = {
        success: { bg: "#4CAF50", text: "#fff" },
        error: { bg: "#f44336", text: "#fff" },
        warning: { bg: "#ff9800", text: "#fff" },
        loading: { bg: "#2196F3", text: "#fff" },
        info: { bg: "#fff", text: "#333" }
    };

    const color = colors[type] || colors.info;
    const isLoading = type === "loading";

    const popup = document.createElement("div");
    popup.id = "custom-popup";
    popup.style.cssText = `
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;
        z-index:10001; overflow: auto;
    `;
    popup.innerHTML = `
        <div style="background:${color.bg}; color:${color.text}; padding:1.6rem; border-radius:14px; max-width:420px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); margin: auto; text-align: center;">
            <p style="margin-bottom: ${isLoading ? '0' : '1rem'};">${message}</p>
            ${!isLoading ? '<button id="popup-ok" style="margin-top:0.6rem; padding:8px 16px; border:none; border-radius:8px; background:rgba(255,255,255,0.9); color:#333; cursor:pointer; font-weight:bold;">OK</button>' : ''}
        </div>
    `;

    if (!isLoading) {
        popup.querySelector("#popup-ok").addEventListener("click", () => popup.remove());
        setTimeout(() => {
            const el = document.getElementById("custom-popup");
            if (el) el.remove();
        }, 5000);
    }

    document.body.appendChild(popup);
}

// =================== WELCOME MESSAGE ===================
function showCustomWelcomePopup(userName, onOKClick) {
    const old = document.getElementById("custom-popup");
    if (old) old.remove();

    const popup = document.createElement("div");
    popup.id = "custom-popup";
    popup.style.cssText = `
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center;
        z-index:10001; overflow: auto; padding: 20px;
    `;

    const welcomeText = userName === "Guest" ?
        "Join our happy family!" :
        `Welcome back, <strong>${userName}</strong>!`;

    popup.innerHTML = `
        <div style="background: linear-gradient(135deg, #FF6B6B, #4ECDC4); color: white; padding: 2rem; border-radius: 20px; max-width: 450px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); text-align: center; margin: auto;">
            <h2 style="font-size: 1.8rem; margin-bottom: 1rem; font-family: 'Fredoka One', cursive;">🧸 Welcome to AbuToys!</h2>
            <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">${welcomeText}</p>
            <p style="font-size: 0.95rem; margin-bottom: 1.5rem; opacity: 0.9;">We need to verify your location to check delivery availability.</p>
            <button id="welcome-ok-btn" style="padding: 12px 30px; border: none; border-radius: 25px; background: white; color: #FF6B6B; cursor: pointer; font-weight: bold; font-size: 1rem;">OK, Check Location</button>
        </div>
    `;

    document.body.appendChild(popup);
    document.getElementById("welcome-ok-btn").addEventListener("click", () => {
        popup.remove();
        showLocationLoader();   // 🔥 NEW LINE (animation starts)
        setTimeout(() => {
            if (onOKClick) onOKClick();
        }, 300); // small delay so loader shows smoothly

    });
}

// async function showWelcomeMessage() {
//     const isFirstVisit = !sessionStorage.getItem("abutoys_welcomed");

//     if (!isFirstVisit) {
//         console.log("ℹ️ Not first visit, skipping welcome");
//         return;
//     }

//     sessionStorage.setItem("abutoys_welcomed", "true");

//     let userName = "Guest";
//     if (userManager.isLoggedIn()) {
//         const user = userManager.getUser(userManager.currentUser);
//         if (user) userName = user.fullName;
//     }

//     console.log("👋 Showing welcome for:", userName);

//     showCustomWelcomePopup(userName, async () => {
//         const res = await startLocationVerification();
//         hideLocationLoader(); // 🔥 Stop animation here


//         // Result ke base pe message dikhao
//         if (res.status === 'in_range') {
//             showPopup(`✅ Location Verified!\n\nDelivery Charge: Rs.${res.deliveryCharge}\n\nYou can purchase items!`, "success");
//         }
//         else if (res.status === 'out_of_range') {
//             showPopup(`❌ Sorry!\n\nYou are ${Math.round(res.distance)} km away.\n\nWe don't deliver there.`, "warning");
//         }
//         else if (res.status === 'permission_denied') {
//             showPopup(`⚠️ Location Access Denied!\n\nPlease enable location in browser settings:\n1. Click lock icon 🔒 in address bar\n2. Allow location access\n3. Refresh page`, "error");
//         }
//         else {
//             showPopup(`⚠️ Cannot detect location\n\nPlease check your GPS/internet`, "warning");
//         }

//         // Sirf agar logged in nahi hai to form dikhao
//         if (!userManager.isLoggedIn()) {
//             setTimeout(() => {
//                 showAccountModal();
//             }, 2000);
//         }
//     });
// }

/* ====== WhatsApp with location-check & prefilled message (replace old openWhatsApp) ====== */

function openWhatsAppDirect() {
    // get name from localStorage (fallback to userManager if available)
    let displayName = "Guest";
    try {
        const cur = localStorage.getItem("abutoys_current_user");
        if (cur && cur !== "null") {
            const stored = localStorage.getItem(`abutoys_user_${cur}`);
            if (stored) {
                const u = JSON.parse(stored);
                if (u && u.fullName) displayName = u.fullName;
            }
        } else if (typeof userManager !== "undefined" && userManager.getCurrentUserName) {
            displayName = userManager.getCurrentUserName() || displayName;
        }
    } catch (e) {
        console.warn("Error reading user name:", e);
    }

    // Message exactly as requested
    const message = `Hii 🧸 AbuToys, My name is "${displayName}"`;
    const encodedMessage = encodeURIComponent(message);

    // open whatsapp (use target _blank)
    window.open(`https://wa.me/8160154042?text=${encodedMessage}`, "_blank");
}

function showLocationRequiredForWhatsAppPopup() {
    // If there is already our popup, don't duplicate
    if (document.getElementById("whatsapp-location-required-popup")) return;

    const overlay = document.createElement("div");
    overlay.id = "whatsapp-location-required-popup";
    overlay.style.cssText = `
        position: fixed; inset: 0; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.6); z-index:10010; padding:16px;
    `;
    overlay.innerHTML = `
        <div style="max-width:420px; width:100%; background:#fff; border-radius:12px; padding:18px; text-align:left; box-shadow:0 10px 40px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 8px; font-size:18px;">⚠️ Location Unverified</h3>
            <p style="margin:0 0 12px; color:#444; font-size:15px;">
                Sorry — your location is unverified. Please enable your location to use the WhatsApp function.
            </p>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="whatsapp-loc-cancel" style="padding:8px 12px; background:#eee; border:0; border-radius:8px; cursor:pointer;">Cancel</button>
                <button id="whatsapp-loc-verify" style="padding:8px 12px; background:#25d366; color:#fff; border:0; border-radius:8px; cursor:pointer;">Verify Now</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("whatsapp-loc-cancel").addEventListener("click", () => {
        overlay.remove();
    });

    document.getElementById("whatsapp-loc-verify").addEventListener("click", async () => {
        overlay.remove();
        try { showLocationLoader(); } catch(e){/* ignore */ }
        // startLocationVerification returns the normalized result (we used that earlier)
        const res = await startLocationVerification();
        try { hideLocationLoader(); } catch(e){/* ignore */ }

        // If location now verified -> open direct
        if (res && res.status === "in_range") {
            showPopup("✅ Location verified. Opening WhatsApp...", "success");
            // small delay so user sees popup
            setTimeout(() => openWhatsAppDirect(), 350);
        } else if (res && res.status === "permission_denied") {
            showPopup("⚠️ Location permission denied. Please enable GPS/permissions and try again.", "error");
        } else {
            showPopup("⚠️ Could not verify location. Try again.", "warning");
        }
    });
}

function openWhatsApp() {
    // If user not logged in, ask them to sign up (keep previous behavior)
    if (typeof userManager !== "undefined" && !userManager.isLoggedIn()) {
        showPopup("❌ Please sign up first!", "warning");
        return;
    }

    const status = localStorage.getItem("abutoys_location_status"); // possible values: in_range, out_of_range, permission_denied, manual, unknown, etc.

    // If location not verified (not 'in_range') -> show the special popup with Verify Now button
    if (status !== "in_range") {
        // special message required by you
        showLocationRequiredForWhatsAppPopup();
        return;
    }

    // If in_range, proceed to open WhatsApp with prefilled message
    openWhatsAppDirect();
}

/* === Hook footer whatsapp button (if present) so footer also uses same logic === */
document.addEventListener("DOMContentLoaded", () => {
    const footerBtn = document.getElementById("footerWhatsAppBtn");
    if (footerBtn) {
        // remove old listeners to avoid duplicates (best-effort)
        footerBtn.replaceWith(footerBtn.cloneNode(true));
        const newFooterBtn = document.getElementById("footerWhatsAppBtn") || document.querySelector("[data-footer-whatsapp]");
        if (newFooterBtn) newFooterBtn.addEventListener("click", (e) => { e.preventDefault(); openWhatsApp(); });
    }
});

// =================== WHATSAPP ===================
// function openWhatsApp() {
//     if (!userManager.isLoggedIn()) {
//         showPopup("❌ Please sign up first!", "warning");
//         return;
//     }

//     const locationStatus = locationManager.getLocationStatus();

//     if (locationStatus === 'out_of_range') {
//         showPopup("❌ Sorry! You are outside 20 km delivery area.", "warning");
//         return;
//     }

//     const userName = userManager.getCurrentUserName();
//     const distance = locationManager.distance ? locationManager.distance.toFixed(2) : "Unknown";
//     const message = `Hi, I am ${userName}. Distance: ${distance} km. I want to purchase toys.`;

//     const encodedMessage = encodeURIComponent(message);
//     window.open(`https://wa.me/9879254030?text=${encodedMessage}`, '_blank');
// }

// =================== ACCOUNT MODAL ===================
function showAccountModal() {
    console.log("📝 Opening account modal...");

    if (userManager.isLoggedIn()) {
        window.location.href = "userprofile.html";
        return;
    }

    const modal = document.getElementById("accountModal");
    if (modal) {
        modal.style.display = "block";
        console.log("✅ Modal displayed");
    } else {
        console.error("❌ Modal not found!");
    }
}

function closeAccountModal() {
    const modal = document.getElementById("accountModal");
    if (modal) {
        modal.style.display = "none";
    }
}

// =================== HERO SLIDER ===================
function initHeroSlider() {
    let current = 0;
    const slides = document.querySelectorAll(".slide");
    if (slides && slides.length > 0) {
        setInterval(() => {
            slides[current].classList.remove("active");
            current = (current + 1) % slides.length;
            slides[current].classList.add("active");
        }, 5000);
    }
    console.log("✅ Hero slider started");
}

// =================== FLOATING BUTTONS ===================
function createFloatingButtons() {
    console.log("📧 Creating floating buttons...");

    const whatsappFloat = document.createElement("div");
    whatsappFloat.className = "whatsapp-float";
    whatsappFloat.innerHTML = `<i class="fab fa-whatsapp"></i>`;
    whatsappFloat.style.cssText = `
        position: fixed; 
        bottom: 100px; 
        right: 20px;
        background: #25d366; 
        color: white; 
        border-radius: 50%;
        width: 60px; 
        height: 60px; 
        display: flex;
        align-items: center; 
        justify-content: center;
        box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
        cursor: pointer; 
        z-index: 999; 
        font-size: 28px;
        transition: all 0.3s ease; 
        opacity: 0; 
        visibility: hidden;
    `;

    whatsappFloat.addEventListener("mouseenter", () => {
        whatsappFloat.style.transform = "scale(1.05)";
    });

    whatsappFloat.addEventListener("mouseleave", () => {
        whatsappFloat.style.transform = "scale(1)";
    });

    whatsappFloat.addEventListener("click", openWhatsApp);
    document.body.appendChild(whatsappFloat);
    console.log("✅ WhatsApp button added");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            whatsappFloat.style.opacity = "1";
            whatsappFloat.style.visibility = "visible";
        } else {
            whatsappFloat.style.opacity = "0";
            whatsappFloat.style.visibility = "hidden";
        }
    });
}

// =================== FLOATING REGISTRATION BUTTON ===================
function createFloatingRegisterButton() {
    console.log("👤 Creating floating registration button...");

    const regFloat = document.createElement("div");
    regFloat.id = "floatingRegBtn";
    regFloat.innerHTML = `<i class="fas fa-user-plus"></i>`;
    regFloat.style.cssText = `
        position: fixed; 
        bottom: 100px; 
        right: 20px;
        background: linear-gradient(45deg, #FF6B6B, #4ECDC4); 
        color: white; 
        border-radius: 50%;
        width: 60px; 
        height: 60px; 
        display: flex;
        align-items: center; 
        justify-content: center;
        box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
        cursor: pointer; 
        z-index: 999; 
        font-size: 28px;
        transition: all 0.3s ease; 
        opacity: 0; 
        visibility: hidden;
    `;

    regFloat.addEventListener("mouseenter", () => {
        regFloat.style.transform = "scale(1.05)";
    });

    regFloat.addEventListener("mouseleave", () => {
        regFloat.style.transform = "scale(1)";
    });

    regFloat.addEventListener("click", () => {
        showAccountModal();
    });

    document.body.appendChild(regFloat);
    console.log("✅ Registration button added");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            regFloat.style.opacity = "1";
            regFloat.style.visibility = "visible";
        } else {
            regFloat.style.opacity = "0";
            regFloat.style.visibility = "hidden";
        }
    });
}

function updateFloatingButtons() {
    const whatsappBtn = document.querySelector(".whatsapp-float");
    const regBtn = document.getElementById("floatingRegBtn");

    if (userManager.isLoggedIn()) {
        if (whatsappBtn) whatsappBtn.style.display = "flex";
        if (regBtn) regBtn.style.display = "none";
    } else {
        if (whatsappBtn) whatsappBtn.style.display = "none";
        if (regBtn) regBtn.style.display = "flex";
    }
}

// =================== DOM READY ===================
document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 DOM Ready");

    // ========= HAMBURGER MENU FIX =========
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", (e) => {
            e.stopPropagation();
            navMenu.classList.toggle("active");
            hamburger.classList.toggle("active");
            console.log("📱 Hamburger clicked - menu active:", navMenu.classList.contains("active"));
        });

        // Close menu when nav link clicked
        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("active");
                hamburger.classList.remove("active");
                console.log("📱 Nav link clicked - menu closed");
            });
        });

        // Close menu when clicking outside
        document.addEventListener("click", (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove("active");
                hamburger.classList.remove("active");
            }
        });
    } else {
        console.warn("⚠️ Hamburger or nav-menu not found");
    }

    // ========= PHONE INPUT ==========
    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
        phoneInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }

    // ========= SIGNUP FORM ==========
    const signupForm = document.getElementById("signupForm");

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fullName = document.getElementById("fullName").value.trim();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const address = document.getElementById("address").value.trim();

            if (!fullName || !email || !password || !phone || !address) {
                showPopup("❌ Please fill all fields!", "error");
                return;
            }

            if (phone.length !== 10) {
                showPopup("❌ Phone number must be 10 digits!", "error");
                return;
            }

            const userData = {
                fullName,
                email,
                password,
                phone: "+91" + phone,
                address
            };

            // UserManager ka register function call karo
            const success = await userManager.register(userData);

            if (success) {
                // Form reset karo
                signupForm.reset();
            }
        });
    } else {
        console.error("❌ signupForm not found in DOM");
    }



    // ========= CART ICON ==========
    const cartIcon = document.getElementById("cartIcon");
    if (cartIcon) {
        cartIcon.addEventListener("click", () => {
            if (!userManager.isLoggedIn()) {
                showPopup("❌ Please sign up first!", "warning");
                return;
            }
            console.log("🛒 Cart clicked");
        });
    }

    // ========= CLOSE BUTTON ==========
    const closeBtn = document.getElementById('closeSignupBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById("accountModal");
            if (modal) modal.style.display = 'none';
            updateFloatingButtons();
        });
    }

    // ========= PASSWORD EYE TOGGLE ==========
    const eye = document.querySelector('.toggle-password');
    if (eye) {
        eye.addEventListener('click', function () {
            const pass = document.getElementById('password');
            if (!pass) return;
            if (pass.type === 'password') {
                pass.type = 'text';
                eye.classList.remove('fa-eye');
                eye.classList.add('fa-eye-slash');
            } else {
                pass.type = 'password';
                eye.classList.add('fa-eye');
                eye.classList.remove('fa-eye-slash');
            }
        });
    }
});

// =================== PAGE LOAD ===================
window.addEventListener("load", () => {
    console.log("✅ Page loaded, initializing...");

    setTimeout(() => {
        initHeroSlider();
        createFloatingButtons();
        createFloatingRegisterButton();
        updateFloatingButtons();

        // Har baar welcome message dikhao
        showWelcomeMessage();
    }, 800);
});


// =================== DELETE ACCOUNT SYSTEM ===================
function initializeDeleteAccountIcon() {
    const deleteIcon = document.getElementById('deleteAccountIcon');
    if (deleteIcon) {
        deleteIcon.addEventListener('click', () => {
            showDeleteAccountOverlay();
        });
    }
}

function showDeleteAccountOverlay() {
    // Pehle check kar ki user logged in hai ya nahi
    const currentUser = localStorage.getItem("abutoys_current_user");

    if (!currentUser || currentUser === "null" || currentUser === "" || currentUser === "visitor") {
        showPopup("❌ Please create account first to delete account!", "error");
        return;
    }

    // Overlay create kar
    const overlay = document.createElement('div');
    overlay.id = 'delete-account-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10005;
        padding: 20px;
    `;

    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.4s ease-out;
        ">
            <div style="font-size: 3.5rem; margin-bottom: 20px; color: #FF6B6B;">⚠️</div>
            
            <h2 style="
                color: #333;
                font-size: 1.8rem;
                margin-bottom: 15px;
                font-family: 'Fredoka One', cursive;
            ">Delete Account?</h2>
            
            <p style="
                color: #666;
                font-size: 1rem;
                line-height: 1.6;
                margin-bottom: 25px;
            ">
                ⚠️ <strong>Warning:</strong> Deleting your account will permanently remove all your data including:
                <br><br>
                • Account Information
                <br>
                • Saved Addresses
                <br>
                • Wishlist Items
                <br>
                • Password
            </p>

            <p style="
                color: #FF6B6B;
                font-size: 1.1rem;
                font-weight: 700;
                margin-bottom: 30px;
            ">
                This action cannot be undone! 🔒
            </p>

            <p style="
                color: #999;
                font-size: 0.95rem;
                margin-bottom: 25px;
            ">
                Are you sure you want to delete your account?
            </p>

            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="cancelDeleteBtn" style="
                    padding: 12px 30px;
                    background: #e0e0e0;
                    border: none;
                    border-radius: 25px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                ">
                    ✕ Cancel
                </button>
                <button id="confirmDeleteBtn" style="
                    padding: 12px 30px;
                    background: #FF6B6B;
                    color: white;
                    border: none;
                    border-radius: 25px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                ">
                    🗑️ Delete Account
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cancel button
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        overlay.remove();
    });

    // Delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        deleteUserAccount(overlay);
    });

    // Background click se bhi close ho
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

function deleteUserAccount(overlay) {
    // Get current user
    const currentUser = localStorage.getItem("abutoys_current_user");

    // Delete user data
    try {
        localStorage.removeItem(`abutoys_user_${currentUser}`);
        localStorage.removeItem("abutoys_current_user");
        localStorage.removeItem("abutoys_user_location");
        localStorage.removeItem("abutoys_location_status");
        localStorage.removeItem("abutoys_delivery_charge");
        localStorage.removeItem("abutoys_user_distance");
        localStorage.removeItem("abutoys_liked_products");
        localStorage.removeItem("abutoys_cart");
    } catch (e) {
        console.log("Error deleting data:", e);
    }

    // Set deletion flag with timestamp
    const deletionTime = Date.now();
    try {
        localStorage.setItem("abutoys_account_deleted", "true");
        localStorage.setItem("abutoys_deletion_timestamp", deletionTime.toString());
    } catch (e) {
        console.log("Error setting deletion flag:", e);
    }

    // Close pehla overlay
    overlay.remove();

    // Show 30-minute overlay
    showPostDeletionOverlay();
}

function showPostDeletionOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'post-deletion-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10006;
        padding: 20px;
    `;

    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.4s ease-out;
        ">
            <div style="font-size: 3.5rem; margin-bottom: 20px;">✅</div>
            
            <h2 style="
                color: #333;
                font-size: 1.8rem;
                margin-bottom: 15px;
                font-family: 'Fredoka One', cursive;
            ">Account Deleted Successfully</h2>
            
            <p style="
                color: #666;
                font-size: 1rem;
                line-height: 1.6;
                margin-bottom: 15px;
            ">
                Your account has been deleted from our system.
            </p>

            <p style="
                color: #FF6B6B;
                font-size: 1.1rem;
                font-weight: 700;
                margin-bottom: 20px;
            ">
                ⏳ You can create a new account after:
            </p>

            <div id="timerDisplay" style="
                background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
                color: white;
                padding: 20px;
                border-radius: 15px;
                font-size: 2rem;
                font-weight: 800;
                margin-bottom: 25px;
                font-family: 'Courier New', monospace;
                letter-spacing: 2px;
            ">
                30:00:00
            </div>

            <p style="
                color: #999;
                font-size: 0.9rem;
                margin-bottom: 20px;
            ">
                (Hours : Minutes : Seconds)
            </p>

            <button onclick="window.location.href='index.html'" style="
                padding: 12px 30px;
                background: #4ECDC4;
                color: white;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: all 0.3s ease;
            ">
                🏠 Go to Home
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Start timer
    startDeletionTimer(overlay);
}

function startDeletionTimer(overlay) {
    const deletionTimestamp = parseInt(localStorage.getItem("abutoys_deletion_timestamp") || "0");
    const THIRTY_MINUTES = 30 * 60 * 1000; // 30 minutes in milliseconds

    function updateTimer() {
        const now = Date.now();
        const timePassed = now - deletionTimestamp;
        const timeRemaining = THIRTY_MINUTES - timePassed;

        if (timeRemaining <= 0) {
            // Timer complete - remove overlay aur flag
            try {
                localStorage.removeItem("abutoys_account_deleted");
                localStorage.removeItem("abutoys_deletion_timestamp");
            } catch (e) { }

            overlay.remove();
            showPopup("✅ You can now create a new account!", "success");
            return;
        }

        // Calculate hours, minutes, seconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        // Format with leading zeros
        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = formattedTime;
        }

        // Update har second
        setTimeout(updateTimer, 1000);
    }

    // Start immediately
    updateTimer();
}

// Check on page load agar deletion active hai
function checkIfAccountDeleted() {
    const isDeleted = localStorage.getItem("abutoys_account_deleted");

    if (isDeleted === "true") {
        const deletionTimestamp = parseInt(localStorage.getItem("abutoys_deletion_timestamp") || "0");
        const THIRTY_MINUTES = 30 * 60 * 1000;
        const now = Date.now();
        const timePassed = now - deletionTimestamp;

        if (timePassed < THIRTY_MINUTES) {
            // Still within 30 minutes - show overlay
            showPostDeletionOverlay();
        } else {
            // 30 minutes over - clear flags
            localStorage.removeItem("abutoys_account_deleted");
            localStorage.removeItem("abutoys_deletion_timestamp");
        }
    }
}

// Add CSS animation
function addDeleteAccountStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        #deleteAccountIcon {
            transition: all 0.3s ease;
        }

        #deleteAccountIcon:hover {
            transform: scale(1.15);
            color: #FF4545 !important;
        }
    `;
    document.head.appendChild(style);
}

// Call in DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    addDeleteAccountStyles();
    initializeDeleteAccountIcon();
    checkIfAccountDeleted();
});

// Allow using product page order history from home page
function openOrderHistoryFromHome() {
    window.location.href = "toyproduct.html?orders=1";
}

/* ===================== FLOATING LOCATION BUTTON ===================== */

function createFloatingLocationButton() {
    const locBtn = document.createElement("div");
    locBtn.id = "floatingLocationBtn";

    locBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i>`;

    locBtn.style.cssText = `
        position: fixed;
        bottom: 25px;
        left: 20px;
        width: 60px;
        height: 60px;
        background: #ff4757;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        z-index: 999;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: 0.3s ease;
    `;

    // Hover animation
    locBtn.addEventListener("mouseenter", () => {
        locBtn.style.transform = "scale(1.1)";
    });

    locBtn.addEventListener("mouseleave", () => {
        locBtn.style.transform = "scale(1)";
    });

    // Click open popup
    locBtn.addEventListener("click", () => {
        openLocationPopup();
    });

    document.body.appendChild(locBtn);
}


function openLocationPopup() {
    const status = localStorage.getItem("abutoys_location_status");

    // Already open? → close it on second click
    const oldPopup = document.getElementById("locationPopup");
    if (oldPopup) {
        oldPopup.remove();
        return; // no new popup
    }

    const popup = document.createElement("div");
    popup.id = "locationPopup";

    popup.style.cssText = `
        position: fixed;
        bottom: 95px;
        left: 20px;
        background: white;
        padding: 18px;
        width: 320px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.25);
        z-index: 2000;
        animation: popIn 0.3s ease;
        font-family: sans-serif;
    `;

    let html = "";
    let showVerifyBtn = false; // 👉 yahan se control karenge

    if (status === "permission_denied") {
        html = `
            <h3 style="margin:0; font-size:18px; color:#d63031;">❌ Location Denied</h3>
            <p style="margin:8px 0; font-size:15px;">
                You denied location access.<br>
                <b>You can't purchase any item.</b><br>
                After allowing location in browser/app settings, tap below:
            </p>
        `;
        showVerifyBtn = true; // ❌ deny ke baad bhi "Verify Now" dikhega
    }
    else if (status === "in_range") {
        const charge = localStorage.getItem("abutoys_delivery_charge");
        html = `
            <h3 style="margin:0; font-size:18px; color:#2ecc71;">✅ Location Verified</h3>
            <p style="margin:8px 0; font-size:15px;">
                Delivery Available!<br>
                <b>Delivery Charge: ₹${charge}</b>
            </p>
        `;
        // in_range me button nahi chahiye (already verified)
    }
    else if (status === "out_of_range") {
        html = `
            <h3 style="margin:0; font-size:18px; color:#e67e22;">⚠️ Out of Range</h3>
            <p style="margin:8px 0; font-size:15px;">
                Sorry! You are outside the 20km delivery area.<br>
                If you moved to a new location, tap below to re-check:
            </p>
        `;
        showVerifyBtn = true; // ⚠️ yahan bhi dobara check karne ka option
    }
    else {
        // null / unknown / manual / no_geo sab yahan aa jayenge
        html = `
            <h3 style="margin:0; font-size:18px; color:#0984e3;">📍 Location Unknown</h3>
            <p style="margin:8px 0; font-size:15px;">
                Click below to verify your location.
            </p>
        `;
        showVerifyBtn = true;
    }

    // 👉 Common "Verify Now" button agar showVerifyBtn true hai
    if (showVerifyBtn) {
        html += `
            <button id="verifyLocationBtn" style="
                margin-top:10px;
                padding:10px 18px;
                background:#0984e3;
                color:white;
                border:none;
                border-radius:8px;
                cursor:pointer;
                font-weight:bold;
            ">Verify Now</button>
        `;
    }

    popup.innerHTML = html;
    document.body.appendChild(popup);

    // Agar button hai tabhi listener lagayenge
    const btn = document.getElementById("verifyLocationBtn");
    if (btn) {
        btn.addEventListener("click", async () => {
            popup.remove();
            showLocationLoader();
            const res = await startLocationVerification(); // iske andar verifyUserLocation_debug bhi use ho sakta hai
            hideLocationLoader();

            if (res.status === "in_range") {
                showPopup("✅ Location Verified!", "success");
            } else if (res.status === "out_of_range") {
                showPopup("❌ You are outside 20km area!", "error");
            } else if (res.status === "permission_denied") {
                showPopup("⚠️ Location access denied again!", "warning");
            } else {
                showPopup("⚠️ Cannot verify location", "warning");
            }
        });
    }

    // CLICK ANYWHERE OUTSIDE → CLOSE  
    setTimeout(() => enablePopupCloseOnOutsideClick(popup), 50);
}

/* ============ POPUP ANIMATION CSS ============ */
const floatCss = document.createElement("style");
floatCss.textContent = `
@keyframes popIn {
    from { transform: translateY(10px); opacity:0; }
    to { transform: translateY(0px); opacity:1; }
}
`;
document.head.appendChild(floatCss);

function enablePopupCloseOnOutsideClick(popup) {
    function outsideClick(e) {
        const locBtn = document.getElementById("floatingLocationBtn");

        if (!popup.contains(e.target) && e.target !== locBtn) {
            popup.remove();
            document.removeEventListener("click", outsideClick);
        }
    }
    document.addEventListener("click", outsideClick);
}

window.addEventListener("load", () => {
    setTimeout(() => {
        createFloatingLocationButton();   // ⭐ New Floating Button
    }, 1000);
});
