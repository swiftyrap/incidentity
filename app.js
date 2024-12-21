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

// Locate user's current position
map.locate({ setView: true, maxZoom: 16 });

// Handle location found
map.on('locationfound', (e) => {
    L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
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

    // Open the camera for photo capture
    const photoFile = await capturePhoto();
    if (!photoFile) {
        alert("Photo capture failed.");
        return;
    }

    // Show modal for issue type selection
    const formModal = new bootstrap.Modal(document.getElementById('formModal'));
    formModal.show();

    document.getElementById('form-submit').onclick = () => {
        const issueType = document.getElementById('issue-type').value;

        // Add marker with photo and issue type
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
