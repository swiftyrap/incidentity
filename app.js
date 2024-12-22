// Initialize the map
const map = L.map('map', { zoomControl: false }).setView([0, 0], 16);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Create a marker with rotation support
const userMarker = L.marker([0, 0], {
    icon: L.divIcon({
        html: `<div style="transform: rotate(0deg); width: 30px; height: 30px; background-color: blue; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
                <div style="width: 10px; height: 20px; background-color: white; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>
               </div>`,
        className: '',
    }),
}).addTo(map);

// Function to update marker position
function updateMarkerPosition(lat, lng) {
    userMarker.setLatLng([lat, lng]);
}

// Function to update marker rotation
function updateMarkerRotation(angle) {
    userMarker.options.icon.options.html = `<div style="transform: rotate(${angle}deg); width: 30px; height: 30px; background-color: blue; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
        <div style="width: 10px; height: 20px; background-color: white; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>
    </div>`;
    userMarker.setIcon(userMarker.options.icon);
}

// Track user position with watchPosition
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            updateMarkerPosition(latitude, longitude);
            map.setView([latitude, longitude], map.getZoom());
        },
        (error) => {
            alert(`Error: ${error.message}`);
        },
        { enableHighAccuracy: true }
    );
} else {
    alert("Geolocation is not supported by your browser.");
}

// Track device orientation
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
        if (event.alpha !== null) {
            const rotationAngle = 360 - event.alpha; // Calculate rotation angle
            updateMarkerRotation(rotationAngle);
        }
    });
} else {
    alert("Device orientation is not supported by your browser.");
}
