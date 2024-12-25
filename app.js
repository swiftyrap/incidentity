/***********************************************
 *  GLOBALS & INITIAL SETUP
 ***********************************************/
let map;
let userMarker = null;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup({
  // custom cluster styling if you like, but main point is z-index 
  // is set via CSS 
});

// Stats data for incident types
let incidentsData = {}; 
// Full incident objects
let incidents = [];
// Up/Down votes
let incidentsVotes = {};

// Chart references
let lineChart = null;

/***********************************************
 *  INIT MAP & GEOLOCATION
 ***********************************************/
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude } = pos.coords;
    currentPosition = [latitude, longitude];

    // Create map
    map = L.map('map').setView(currentPosition, 13);

    // Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add cluster group
    map.addLayer(markerClusterGroup);

    // If you want a custom arrow icon:
    const arrowIcon = L.icon({
      iconUrl: 'arrow.png',
      iconSize: [32, 32],
      className: 'user-arrow' // so we can set z-index in CSS if needed
    });
    userMarker = L.marker(currentPosition, {
      icon: arrowIcon,
      rotationAngle: 0,
      rotationOrigin: 'center center'
    }).addTo(map);

    watchLocationUpdates();
    enableDeviceOrientation();
  },
  (err) => {
    console.error('Geolocation error:', err);
    fallbackMap();
  },
  { enableHighAccuracy: true }
);

function fallbackMap() {
  map = L.map('map').setView([53.8, -1.5], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  map.addLayer(markerClusterGroup);
  watchLocationUpdates();
  enableDeviceOrientation();
}

/***********************************************
 *  WATCH GEOLOCATION
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
 *  DEVICE ORIENTATION -> ROTATE MARKER
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
 *  BIND UI EVENTS
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
  // Hide side panel on map click
  setTimeout(() => {
    if (map) {
      map.on('click', () => hideIncidentPanel());
    }
  }, 500);

  // Tab switching
  document.getElementById('map-tab').addEventListener('click', () => {
    showMap();
  });
  document.getElementById('stats-tab').addEventListener('click', () => {
    showStatistics();
  });

  // "Report Incident" => open modal
  const formModal = new bootstrap.Modal(document.getElementById('formModal'));
  document.getElementById('report-button').addEventListener('click', () => {
    formModal.show();
  });

  // Modal "Submit" button
  document.getElementById('modal-submit-btn').addEventListener('click', () => {
    finalizeIncidentSubmission();
    formModal.hide();
  });

  // Close side panel
  document.getElementById('close-panel-btn').addEventListener('click', () => {
    hideIncidentPanel();
  });

  // Date filter in stats
  document.getElementById('date-filter').addEventListener('change', handleDateFilterChange);
});

/***********************************************
 *  TAB SWITCHING
 ***********************************************/
function showMap() {
  document.getElementById('map-tab').classList.add('active');
  document.getElementById('stats-tab').classList.remove('active');

  document.getElementById('map-container').style.display = 'block';
  document.getElementById('stats-container').style.display = 'none';
}

function showStatistics() {
  document.getElementById('map-tab').classList.remove('active');
  document.getElementById('stats-tab').classList.add('active');

  document.getElementById('map-container').style.display = 'none';
  document.getElementById('stats-container').style.display = 'block';

  // Load stats data
  loadStatisticsData();
}

/***********************************************
 *  INCIDENT SUBMISSION
 ***********************************************/
function finalizeIncidentSubmission() {
  if (!currentPosition) {
    console.warn('No current location found');
    return;
  }

  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];

  // Update stats
  if (!incidentsData[issueType]) {
    incidentsData[issueType] = 0;
  }
  incidentsData[issueType] += 1;

  const incId = 'incident-' + Date.now();
  if (!incidentsVotes[incId]) {
    incidentsVotes[incId] = { up: 0, down: 0 };
  }

  const reportedTime = new Date().toLocaleString();

  const newIncident = {
    id: incId,
    type: issueType,
    time: reportedTime,
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null
  };

  // Photo
  if (photoFile) {
    newIncident.photoURL = URL.createObjectURL(photoFile);
  }

  incidents.push(newIncident);

  // Create marker
  const marker = L.marker([newIncident.lat, newIncident.lng]);
  markerClusterGroup.addLayer(marker);

  marker.on('click', () => showIncidentPanel(newIncident));

  // Reset form
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';
}

/***********************************************
 *  SIDE PANEL
 ***********************************************/
function showIncidentPanel(incident) {
  const { id, type, time, photoURL } = incident;

  const votes = incidentsVotes[id] || { up: 0, down: 0 };
  let html = `
    <h3>${type}</h3>
    <p><small>Reported: ${time}</small></p>
  `;
  if (photoURL) {
    html += `
      <a href="${photoURL}" target="_blank" rel="noopener noreferrer">
        <img src="${photoURL}" alt="Incident Photo" />
      </a>
    `;
  }
  html += `
    <p>
      Up: ${votes.up} / Down: ${votes.down}
      <button class="btn btn-outline-success btn-sm" onclick="voteUp('${id}')"><i class="fas fa-thumbs-up"></i></button>
      <button class="btn btn-outline-danger btn-sm" onclick="voteDown('${id}')"><i class="fas fa-thumbs-down"></i></button>
    </p>
    <div>
      <button class="btn btn-secondary btn-sm" onclick="shareOnWhatsApp('${type}')"><i class="fab fa-whatsapp"></i></button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnFacebook('${type}')"><i class="fab fa-facebook-f"></i></button>
      <button class="btn btn-secondary btn-sm" onclick="shareOnInstagram('${type}')"><i class="fab fa-instagram"></i></button>
      <button class="btn btn-secondary btn-sm" onclick="copyIncidentLink('${type}')"><i class="fas fa-link"></i></button>
    </div>
  `;
  document.getElementById('incident-content').innerHTML = html;

  const panel = document.getElementById('incident-panel');
  panel.classList.remove('panel-closed');
  panel.classList.add('panel-open');
}

function hideIncidentPanel() {
  const panel = document.getElementById('incident-panel');
  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
}

/***********************************************
 *  VOTING
 ***********************************************/
function voteUp(incId) {
  incidentsVotes[incId].up++;
  const incident = incidents.find(i => i.id === incId);
  showIncidentPanel(incident);
}
function voteDown(incId) {
  incidentsVotes[incId].down++;
  const incident = incidents.find(i => i.id === incId);
  showIncidentPanel(incident);
}

/***********************************************
 *  SHARING
 ***********************************************/
function shareOnWhatsApp(type) {
  const link = `https://wa.me/?text=Incident reported: ${type}`;
  window.open(link, '_blank');
}
function shareOnFacebook(type) {
  const shareUrl = encodeURIComponent(`Incident reported: ${type}`);
  const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  window.open(fbLink, '_blank');
}
function shareOnInstagram(type) {
  window.open('https://www.instagram.com/', '_blank');
}
function copyIncidentLink(type) {
  navigator.clipboard.writeText(`Incident Reported: ${type}`).then(() => {
    console.log('Link copied!');
  });
}

/***********************************************
 *  STATISTICS PAGE (DATE FILTER, SORTED LIST, LINE GRAPH)
 ***********************************************/
function handleDateFilterChange() {
  loadStatisticsData();
}

function loadStatisticsData() {
  // Example: we just simulate some data
  const selectedDate = document.getElementById('date-filter').value;
  const dateText = (selectedDate === '2024-10') ? 'October 2024' :
                   (selectedDate === '2024-09') ? 'September 2024' :
                   'August 2024';

  // The total crimes is sum of incidentsData, if we treat them as "crime counts"
  let total = 0;
  for (const key in incidentsData) {
    total += incidentsData[key];
  }

  // Update "1323 crimes were reported here in October 2024"
  document.getElementById('stats-info').innerHTML =
    `${total} incidents were reported here in ${dateText}`;

  // Sort incidentsData from highest to lowest
  const sortedArray = Object.entries(incidentsData).sort((a,b)=>b[1]-a[1]);
  // Build HTML
  let listHTML = '';
  sortedArray.forEach(([type,count])=>{
    listHTML += `
      <div class="d-flex justify-content-between" style="padding:5px 0; border-bottom:1px solid #ccc;">
        <span>${type}</span>
        <strong>${count}</strong>
      </div>
    `;
  });
  document.getElementById('sorted-incident-list').innerHTML = listHTML;

  // Build a simple line graph for the last 12 months (dummy data)
  const lineCtx = document.getElementById('line-chart').getContext('2d');
  if (lineChart) {
    lineChart.destroy();
  }
  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: [
        'Nov 2023','Dec 2023','Jan 2024','Feb 2024','Mar 2024',
        'Apr 2024','May 2024','Jun 2024','Jul 2024','Aug 2024',
        'Sep 2024','Oct 2024'
      ],
      datasets: [
        {
          label: 'Incidents per Month',
          data: [2000,1900,2150,2020,2100,2200,2050,1990,2100,2200,2000, total + 1800],
          borderColor: '#00c06d',
          backgroundColor: '#CCFFD6',
          fill: true,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:{
          beginAtZero: false
        }
      }
    }
  });
}
