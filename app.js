// Initialize the map without a default location
const map = L.map('map');

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Add MarkerCluster layer with green bubble customization
const markersCluster = L.markerClusterGroup({
    iconCreateFunction: function (cluster) {
        return L.divIcon({
            html: `<div style="background-color: rgba(0, 255, 0, 0.6); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: black; font-size: 14px;">
                ${cluster.getChildCount()}
            </div>`,
            className: 'custom-cluster-icon'
        });
    }
});
map.addLayer(markersCluster);

// Real-time user location tracking
let userMarker = null;
let userCircle = null;

// Enable continuous tracking of the user's location
map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true });

// Handle location updates
map.on('locationfound', (e) => {
    const { lat, lng, accuracy } = e;

    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
        userCircle.setLatLng([lat, lng]);
        userCircle.setRadius(accuracy);
    } else {
        userMarker = L.marker([lat, lng], { icon: L.icon({ iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png' }) });
        userCircle = L.circle([lat, lng], { radius: accuracy, color: 'blue', fillColor: 'blue', fillOpacity: 0.2 });

        userMarker.addTo(map).bindPopup("You are here");
        userCircle.addTo(map);
    }
    map.setView([lat, lng], map.getZoom());
});

// Handle location error
map.on('locationerror', () => {
    alert("Unable to access your location.");
});

let clickedLocation = null;
let tempMarker = null;

// Handle map clicks to select incident location
map.on('click', (e) => {
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    clickedLocation = e.latlng;
    tempMarker = L.marker(e.latlng).addTo(map).bindPopup("Selected location").openPopup();
});

// Handle Report button
document.getElementById('report-button').addEventListener('click', async () => {
    if (!clickedLocation) {
        alert("Please select a location on the map.");
        return;
    }

    const photoFile = await capturePhoto();
    if (!photoFile) {
        alert("Photo capture failed.");
        return;
    }

    const formModal = new bootstrap.Modal(document.getElementById('formModal'));
    formModal.show();

    document.getElementById('form-submit').onclick = () => {
        const issueType = document.getElementById('issue-type').value;

        const marker = L.marker(clickedLocation).addTo(markersCluster);
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

// Function to capture photo
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
