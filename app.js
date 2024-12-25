/***********************************************
 * GLOBALS & INITIAL SETUP
 ***********************************************/
let map;
let userMarker;
let currentPosition;
const markerClusterGroup = L.markerClusterGroup();

// For stats
let incidentsData = {};
// Storing incidents
let incidents = [];
// For up/down votes
let incidentsVotes = {};
// For re-creating chart
let incidentChart = null;

// Modal instance
let formModal;

/***********************************************
 * INIT MAP & GEOLOCATION
 ***********************************************/
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude } = pos.coords;
    currentPosition = [latitude, longitude];

    // Create map
    map = L.map('map').setView(currentPosition, 15);

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add cluster group
    map.addLayer(markerClusterGroup);

    // Create user marker (rotated)
    const userIcon = L.icon({
      iconUrl: 'arrow.png', // arrow.png in same folder
      iconSize: [32, 32]
    });
    userMarker = L.marker(currentPosition, {
      icon: userIcon,
      rotationAngle: 0,
      rotationOrigin: 'center center'
    }).addTo(map);

    watchLocationUpdates();
    enableDeviceOrientation();
  },
  (err) => {
    console.error('Geolocation error:', err);
    initMapFallback();
  },
  { enableHighAccuracy: true }
);

function initMapFallback() {
  map = L.map('map').setView([53.8, -1.5], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.addLayer(markerClusterGroup);

  watchLocationUpdates();
  enableDeviceOrientation();
}

/***********************************************
 * WATCH LOCATION
 ***********************************************/
function watchLocationUpdates() {
  navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      if (userMarker) {
        userMarker.setLatLng(currentPosition);
      }
    },
    (error) => console.log('watchPosition error:', error),
    { enableHighAccuracy: true }
  );
}

/***********************************************
 * DEVICE ORIENTATION
 ***********************************************/
function enableDeviceOrientation() {
  window.addEventListener('deviceorientation', (event) => {
    let heading = event.alpha;
    if (typeof event.webkitCompassHeading === 'number') {
      heading = event.webkitCompassHeading;
    }
    if (userMarker && heading != null) {
      userMarker.setRotationAngle(heading);
    }
  }, true);
}

/***********************************************
 * MAP CLICK -> HIDE PANEL
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for map to exist
  setTimeout(() => {
    if (map) {
      map.on('click', () => {
        hideIncidentPanel();
      });
    }
  }, 500);

  // Setup the modal
  formModal = new bootstrap.Modal(document.getElementById('formModal'));

  // The "Report Incident" button in top-right corner
  document.getElementById('report-button').addEventListener('click', () => {
    formModal.show();
  });

  // Modal "Submit"
  document.getElementById('modal-submit-btn').addEventListener('click', () => {
    finalizeIncidentSubmission();
  });

  // Tabs
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
});

/***********************************************
 * FINALIZE SUBMISSION
 ***********************************************/
function finalizeIncidentSubmission() {
  if (!currentPosition) {
    console.warn('No current location! Please enable location services.');
    formModal.hide();
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];

  const incidentId = 'incident-' + Date.now();
  incidentsVotes[incidentId] = { up: 0, down: 0 };

  if (!incidentsData[issueType]) {
    incidentsData[issueType] = 0;
  }
  incidentsData[issueType] += 1;

  const reportedTime = new Date().toLocaleString();
  const incidentObj = {
    id: incidentId,
    type: issueType,
    time: reportedTime,
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null
  };

  if (photoFile) {
    incidentObj.photoURL = URL.createObjectURL(photoFile);
  }

  incidents.push(incidentObj);

  // Create marker
  const marker = L.marker([incidentObj.lat, incidentObj.lng]);
  markerClusterGroup.addLayer(marker);

  marker.on('click', () => {
    showIncidentPanel(incidentObj);
  });

  // Reset form
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';

  // Hide modal
  formModal.hide();
}

/***********************************************
 * STATISTICS
 ***********************************************/
function loadStatistics() {
  if (incidentChart) {
    incidentChart.destroy();
  }
  const ctx = document.getElementById('incident-bar-chart').getContext('2d');
  const labels = Object.keys(incidentsData);
  const data = Object.values(incidentsData);

  incidentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Number of Incidents',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          barPercentage: 0.3,
          categoryPercentage: 0.5,
          maxBarThickness: 30
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

/***********************************************
 * SIDE PANEL
 ***********************************************/
const incidentPanel = document.getElementById('incident-panel');
const incidentContent = document.getElementById('incident-content');
const closePanelBtn = document.getElementById('close-panel-btn');

closePanelBtn.addEventListener('click', () => {
  hideIncidentPanel();
});

function showIncidentPanel(incident) {
  const incId = incident.id;
  const votes = incidentsVotes[incId];
  const upCount = votes ? votes.up : 0;
  const downCount = votes ? votes.down : 0;

  let html = `
    <h3>${incident.type}</h3>
    <p><small>Reported: ${incident.time}</small></p>
  `;

  if (incident.photoURL) {
    html += `
      <a href="${incident.photoURL}" target="_blank" rel="noopener noreferrer">
        <img src="${incident.photoURL}" alt="Incident Photo" />
      </a>
    `;
  }

  html += `
    <p>Up: ${upCount} / Down: ${downCount}
      <button class="btn btn-outline-success btn-sm" onclick="voteUp('${incId}')">
        <i class="fas fa-thumbs-up"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm" onclick="voteDown('${incId}')">
        <i class="fas fa-thumbs-down"></i>
      </button>
    </p>
    <div>
      <button class="btn btn-secondary btn-sm" onclick="shareOnWhatsApp('${incident.type}')">
        <i class="fab fa-whatsapp"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnFacebook('${incident.type}')">
        <i class="fab fa-facebook-f"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnInstagram('${incident.type}')">
        <i class="fab fa-instagram"></i>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="copyIncidentLink('${incident.type}')">
        <i class="fas fa-link"></i>
      </button>
    </div>
  `;

  incidentContent.innerHTML = html;
  incidentPanel.classList.remove('panel-closed');
  incidentPanel.classList.add('panel-open');
}

function hideIncidentPanel() {
  incidentPanel.classList.remove('panel-open');
  incidentPanel.classList.add('panel-closed');
}

/***********************************************
 * VOTING & SHARING
 ***********************************************/
function voteUp(incidentId) {
  incidentsVotes[incidentId].up++;
  const inc = incidents.find(i => i.id === incidentId);
  showIncidentPanel(inc);
}
function voteDown(incidentId) {
  incidentsVotes[incidentId].down++;
  const inc = incidents.find(i => i.id === incidentId);
  showIncidentPanel(inc);
}
function shareOnWhatsApp(issueType) {
  const link = `https://wa.me/?text=Incident reported: ${issueType}`;
  window.open(link, '_blank');
}
function shareOnFacebook(issueType) {
  const shareUrl = encodeURIComponent(`Incident reported: ${issueType}`);
  const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  window.open(fbLink, '_blank');
}
function shareOnInstagram(issueType) {
  window.open('https://www.instagram.com/', '_blank');
}
function copyIncidentLink(issueType) {
  const text = `Incident Reported: ${issueType}`;
  navigator.clipboard.writeText(text).then(() => {
    console.log('Incident link copied');
  });
}
