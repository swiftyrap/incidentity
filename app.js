// Initialize the map
const map = L.map('map').setView([0, 0], 16);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Real-time user tracking
let userMarker = null;
navigator.geolocation.watchPosition(
    (position) => {
        const { latitude, longitude } = position.coords;

        if (userMarker) {
            userMarker.setLatLng([latitude, longitude]);
        } else {
            userMarker = L.marker([latitude, longitude]).addTo(map).bindPopup("You are here").openPopup();
            map.setView([latitude, longitude], 16);
        }
    },
    (error) => {
        alert(`Geolocation error: ${error.message}`);
    },
    { enableHighAccuracy: true }
);

// Handle reporting incidents
let clickedLocation = null;
let tempMarker = null;

// Allow map clicks to select incident location
map.on('click', (e) => {
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    clickedLocation = e.latlng;
    tempMarker = L.marker(e.latlng).addTo(map).bindPopup("Selected location").openPopup();
});

// Handle the "Report" button
document.getElementById('report-button').addEventListener('click', async () => {
    if (!clickedLocation) {
        alert("Please click on the map to select a location for the incident.");
        return;
    }

    const photoFile = await capturePhoto();
    if (!photoFile) {
        alert("Photo capture failed or was canceled.");
        return;
    }

    const formModal = new bootstrap.Modal(document.getElementById('formModal'));
    formModal.show();

    document.getElementById('form-submit').onclick = () => {
        const issueType = document.getElementById('issue-type').value;

        // Add marker with photo and issue type
        const marker = L.marker(clickedLocation).addTo(map);
        const photoURL = URL.createObjectURL(photoFile);
        marker.bindPopup(`
            <b>Issue Type:</b> ${issueType}<br>
            <img src="${photoURL}" alt="Incident Photo" style="width:100%; height:auto; border-radius:8px; margin-top:10px;">
        `).openPopup();

        formModal.hide();
        map.removeLayer(tempMarker);
        tempMarker = null;
        clickedLocation = null;
    };
});

// Function to capture a photo
async function capturePhoto() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'camera';

        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) resolve(file);
            else reject();
        };

        input.click();
    });
}
