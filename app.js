let map;
let userMarker;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup();

// For stats
let incidentsData = {};
let incidents = [];
let incidentsVotes = {};
let lineChart = null;

// We'll store a reference to the modal
let reportModal;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initUI();
});

function initMap() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      createMap(currentPosition, 13);
    },
    (err) => {
      console.warn('Geo error:', err);
      createMap([53.8, -1.5], 10);
    },
    { enableHighAccuracy: true }
  );
}

function createMap(center, zoom) {
  map = L.map('map').setView(center, zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM contributors'
  }).addTo(map);

  map.addLayer(markerClusterGroup);

  // Optional rotating arrow
  const arrowIcon = L.icon({
    iconUrl: 'arrow.png',
    iconSize: [32, 32],
    className: 'user-arrow'
  });
  userMarker = L.marker(center, {
    icon: arrowIcon,
    rotationAngle: 0,
    rotationOrigin: 'center center'
  }).addTo(map);

  map.on('click', onMapClick);
  map.on('touchstart', onMapClick);

  watchLocation();
  watchOrientation();
}

// On map click/touch, hide side panel
function onMapClick(e) {
  hideSidePanel();
}

// Hide side panel
function hideSidePanel() {
  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
}

function watchLocation() {
  navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      if (userMarker) {
        userMarker.setLatLng(currentPosition);
      }
    },
    (err) => console.log('watchPosition error:', err),
    { enableHighAccuracy: true }
  );
}
function watchOrientation() {
  window.addEventListener('deviceorientation', (evt) => {
    let heading = evt.alpha;
    if (typeof evt.webkitCompassHeading === 'number') {
      heading = evt.webkitCompassHeading;
    }
    if (userMarker && heading != null) {
      userMarker.setRotationAngle(heading);
    }
  }, true);
}

function initUI() {
  // Map / Stats tab switching
  document.getElementById('map-tab').addEventListener('click', () => {
    showMapTab();
  });
  document.getElementById('stats-tab').addEventListener('click', () => {
    showStatsTab();
  });

  // Panel close
  document.getElementById('panel-close-btn').addEventListener('click', hideSidePanel);

  // The "Report Incident" modal
  reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
  document.getElementById('report-btn').addEventListener('click', () => {
    // Show the modal
    reportModal.show();

    // Auto-trigger camera input as soon as modal opens
    setTimeout(() => {
      const photoInput = document.getElementById('photo-upload');
      photoInput.click(); // This attempts to open camera right away
    }, 500);
  });

  // Submit inside modal
  document.getElementById('modal-submit-btn').addEventListener('click', () => {
    finalizeIncidentSubmission();
    reportModal.hide();
  });

  // Stats date filter
  document.getElementById('date-filter').addEventListener('change', loadStatisticsData);
}

/***********************************************
 * TAB SWITCHING
 ***********************************************/
function showMapTab() {
  document.getElementById('map-tab').classList.add('active');
  document.getElementById('stats-tab').classList.remove('active');
  document.getElementById('map-container').style.display = 'block';
  document.getElementById('stats-container').style.display = 'none';
}
function showStatsTab() {
  document.getElementById('stats-tab').classList.add('active');
  document.getElementById('map-tab').classList.remove('active');
  document.getElementById('map-container').style.display = 'none';
  document.getElementById('stats-container').style.display = 'block';
  loadStatisticsData();
}

/***********************************************
 * FINALIZE SUBMISSION
 ***********************************************/
function finalizeIncidentSubmission() {
  if (!currentPosition) {
    console.warn('No location found');
    return;
  }
  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];

  if (!incidentsData[issueType]) {
    incidentsData[issueType] = 0;
  }
  incidentsData[issueType]++;

  const incId = 'incident-' + Date.now();
  incidentsVotes[incId] = { up: 0, down: 0 };

  const newInc = {
    id: incId,
    type: issueType,
    time: new Date().toLocaleString(),
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null
  };
  if (photoFile) {
    newInc.photoURL = URL.createObjectURL(photoFile);
  }
  incidents.push(newInc);

  // Add marker
  const marker = L.marker([newInc.lat, newInc.lng]);
  markerClusterGroup.addLayer(marker);
  marker.on('click', () => showSidePanel(newInc));

  // Reset
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';
}

/***********************************************
 * SIDE PANEL
 ***********************************************/
function showSidePanel(incident) {
  const votes = incidentsVotes[incident.id];
  let html = `
    <h3>${incident.type}</h3>
    <p><small>Reported: ${incident.time}</small></p>
  `;
  if (incident.photoURL) {
    html += `<img src="${incident.photoURL}" alt="Incident Photo" style="width:100%; max-height:200px; object-fit:cover;">`;
  }
  html += `
    <p>Up: ${votes.up} / Down: ${votes.down}
      <button class="btn btn-outline-success btn-sm" onclick="voteUp('${incident.id}')"><i class="fas fa-thumbs-up"></i></button>
      <button class="btn btn-outline-danger btn-sm" onclick="voteDown('${incident.id}')"><i class="fas fa-thumbs-down"></i></button>
    </p>
  `;
  document.getElementById('panel-content').innerHTML = html;

  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-closed');
  panel.classList.add('panel-open');
}
function voteUp(incId) {
  incidentsVotes[incId].up++;
  const inc = incidents.find(i => i.id === incId);
  showSidePanel(inc);
}
function voteDown(incId) {
  incidentsVotes[incId].down++;
  const inc = incidents.find(i => i.id === incId);
  showSidePanel(inc);
}

/***********************************************
 * STATISTICS
 ***********************************************/
function loadStatisticsData() {
  // Example
  const dateVal = document.getElementById('date-filter').value;
  let dateText = '';
  if (dateVal === '2024-10') dateText = 'October 2024';
  else if (dateVal === '2024-09') dateText = 'September 2024';
  else dateText = 'August 2024';

  let total = 0;
  for (const t in incidentsData) total += incidentsData[t];

  document.getElementById('stats-info').innerHTML =
    `${total} incidents were reported in ${dateText}.`;

  // Sort from highest to lowest
  const sorted = Object.entries(incidentsData).sort((a,b) => b[1] - a[1]);
  let listHTML = '';
  sorted.forEach(([type,count]) => {
    listHTML += `
      <div class="d-flex justify-content-between" style="border-bottom:1px solid #ccc; padding:5px 0;">
        <span>${type}</span>
        <strong>${count}</strong>
      </div>
    `;
  });
  document.getElementById('sorted-incident-list').innerHTML = listHTML;

  // line chart
  const ctx = document.getElementById('line-chart').getContext('2d');
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [
        'Nov 2023','Dec 2023','Jan 2024','Feb 2024',
        'Mar 2024','Apr 2024','May 2024','Jun 2024',
        'Jul 2024','Aug 2024','Sep 2024','Oct 2024'
      ],
      datasets: [
        {
          label: 'Incidents per Month',
          data: [2200,2100,2000,2150,2100,2050,2100,2200,2300,2200,2000, total + 1500],
          borderColor: '#00c06d',
          backgroundColor: '#ccffd6',
          fill: true,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
