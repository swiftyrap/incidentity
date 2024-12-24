const map = L.map('map').setView([51.505, -0.09], 13);

// Add map tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

let userMarker = null;
let currentPosition = null; // To store the user's current position
const incidentsData = {};

// Track User Location
navigator.geolocation.watchPosition(
    (position) => {
        const { latitude, longitude } = position.coords;
        currentPosition = [latitude, longitude]; // Update the current position

        if (userMarker) {
            userMarker.setLatLng(currentPosition);
        } else {
            userMarker = L.circleMarker(currentPosition, {
                radius: 8,
                color: 'blue',
                fillColor: 'white',
                fillOpacity: 1,
            }).addTo(map);
        }

        map.setView(currentPosition, 13);
    },
    (error) => {
        console.error(error);
    },
    { enableHighAccuracy: true }
);

// Report Incident
document.getElementById('report-button').addEventListener('click', () => {
    const formModal = new bootstrap.Modal(document.getElementById('formModal'));
    formModal.show();

    document.getElementById('form-submit').onclick = () => {
        if (!currentPosition) {
            alert('Unable to detect your current location. Please enable location services.');
            return;
        }

        const issueType = document.getElementById('issue-type').value;
        const photoFile = document.getElementById('photo-upload').files[0];
        const marker = L.marker(currentPosition);

        let popupContent = `<b>Issue Type:</b> ${issueType}`;
        if (photoFile) {
            const photoURL = URL.createObjectURL(photoFile);
            popupContent += `<br><img src="${photoURL}" alt="Incident Photo" style="width:100%; margin-top:10px;">`;
        }

        popupContent += `
            <br><button class="btn btn-success mt-2" onclick="shareOnWhatsApp('${issueType}')">Share on WhatsApp</button>
            <br><button class="btn btn-secondary mt-2" onclick="copyIncidentLink('${issueType}')">Copy Link</button>
        `;

        marker.bindPopup(popupContent);

        // Add the marker to the map and ensure the popup is fully visible
        marker.addTo(markerClusterGroup).on('popupopen', () => {
            map.panTo(marker.getLatLng(), { animate: true });
            setTimeout(() => map.panBy([0, -100]), 500); // Adjust vertical offset for better visibility
        });

        if (!incidentsData[issueType]) {
            incidentsData[issueType] = 0;
        }
        incidentsData[issueType] += 1;
        formModal.hide();
    };
});

// WhatsApp Sharing Function
function shareOnWhatsApp(issueType) {
    const link = `https://wa.me/?text=Incident reported: ${issueType}`;
    window.open(link, '_blank');
}

// Copy Incident Link Function
function copyIncidentLink(issueType) {
    const link = `Incident Reported: ${issueType}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Incident link copied!');
    });
}

// Tab Switching
document.getElementById('map-tab').addEventListener('click', () => {
    document.getElementById('map-container').style.display = 'block';
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('map-tab').classList.add('active');
    document.getElementById('stats-tab').classList.remove('active');
});

document.getElementById('stats-tab').addEventListener('click', () => {
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('stats-container').style.display = 'block';
    document.getElementById('stats-tab').classList.add('active');
    document.getElementById('map-tab').classList.remove('active');
    loadStatistics();
});

// Populate Statistics
function loadStatistics() {
    const ctx = document.getElementById('incident-bar-chart').getContext('2d');
    const labels = Object.keys(incidentsData);
    const data = Object.values(incidentsData);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Number of Incidents',
                data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow custom size
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
