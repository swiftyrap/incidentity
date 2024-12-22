// Initialize the map
const map = L.map('map').setView([0, 0], 16);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Initialize the marker cluster group
const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

// Real-time user tracking with a blue-white dot
let userMarker = null;

navigator.geolocation.watchPosition(
    (position) => {
        const { latitude, longitude } = position.coords;

        if (userMarker) {
            userMarker.setLatLng([latitude, longitude]);
        } else {
            // Add blue-white dot for live location
            userMarker = L.circleMarker([latitude, longitude], {
                radius: 8,
                color: 'blue',
                fillColor: 'white',
                fillOpacity: 1,
            }).addTo(map);
            map.setView([latitude, longitude], 16);
        }
    },
    (error) => {
        alert(`Geolocation error: ${error.message}`);
    },
    { enableHighAccuracy: true }
);

// Handle reporting incidents
document.getElementById('report-button').addEventListener('click', async () => {
    if (!userMarker) {
        alert("Unable to determine your location. Please try again.");
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

        // Add a new marker for each report to the marker cluster group
        const marker = L.marker(userMarker.getLatLng());
        const photoURL = URL.createObjectURL(photoFile);
        marker.bindPopup(`
            <b>Issue Type:</b> ${issueType}<br>
            <img src="${photoURL}" alt="Incident Photo" style="width:100%; height:auto; border-radius:8px; margin-top:10px;">
        `);

        markerClusterGroup.addLayer(marker); // Add marker to the cluster group
        marker.openPopup();

        formModal.hide();
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
