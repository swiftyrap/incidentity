let map;
let userMarker;
let currentPosition = null;
const markerClusterGroup = L.markerClusterGroup();

// For stats
let incidentsData = {};   //  e.g. { "2024-10": { "Brick Fall":2, "Rubbish...":1 }, "2024-12": { ... } }
let incidents = [];
let incidentsVotes = {};
let lineChart = null;

let reportModal; // for the Bootstrap modal

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initUI();
});

/***********************************************
 *  INIT MAP
 ***********************************************/
function initMap() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentPosition = [pos.coords.latitude, pos.coords.longitude];
      createMap(currentPosition, 13);
    },
    (err) => {
      console.warn('Geolocation error:', err);
      createMap([53.8, -1.5], 10);
    },
    { enableHighAccuracy: true }
  );
}

function createMap(center, zoom) {
  map = L.map('map').setView(center, zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.addLayer(markerClusterGroup);

  // optional user arrow
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

  // hide side panel on map click
  map.on('click', () => hideSidePanel());
  map.on('touchstart', (e) => {
    e.originalEvent.preventDefault();
    hideSidePanel();
  });

  watchLocation();
  watchOrientation();
}

/***********************************************
 *  UI
 ***********************************************/
function initUI() {
  // Tabs
  document.getElementById('map-tab').addEventListener('click', showMapTab);
  document.getElementById('stats-tab').addEventListener('click', showStatsTab);

  // Panel close
  document.getElementById('panel-close-btn').addEventListener('click', hideSidePanel);

  // "Report Incident"
  reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
  document.getElementById('report-btn').addEventListener('click', () => {
    reportModal.show();
    setTimeout(() => {
      const photoInput = document.getElementById('photo-upload');
      photoInput.click();
    }, 400);
  });

  // Modal "Submit"
  document.getElementById('modal-submit-btn').addEventListener('click', () => {
    finalizeIncidentSubmission();
    reportModal.hide();
  });
}

/***********************************************
 *  TABS
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

  // rebuild the date filter & stats
  buildDateFilter();
  loadStatisticsData();
}

/***********************************************
 *  LOCATION / ORIENTATION
 ***********************************************/
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

/***********************************************
 *  FINALIZE INCIDENT
 ***********************************************/
function finalizeIncidentSubmission() {
  if (!currentPosition) {
    console.warn('No location found');
    return;
  }
  const issueType = document.getElementById('issue-type').value;
  const photoFile = document.getElementById('photo-upload').files[0];

  // we store date as "YYYY-MM" to group by month
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}-${month}`;  // e.g. "2024-12"

  // Update incidentsData structure, e.g. { "2024-12": { "Brick Fall": 2, ...}, ... }
  if (!incidentsData[monthKey]) {
    incidentsData[monthKey] = {};
  }
  if (!incidentsData[monthKey][issueType]) {
    incidentsData[monthKey][issueType] = 0;
  }
  incidentsData[monthKey][issueType]++;

  const incId = 'incident-' + Date.now();
  incidentsVotes[incId] = { up: 0, down: 0 };

  const newIncident = {
    id: incId,
    type: issueType,
    time: now.toLocaleString(),  // full date/time
    monthKey,                   // "YYYY-MM"
    lat: currentPosition[0],
    lng: currentPosition[1],
    photoURL: null
  };
  if (photoFile) {
    newIncident.photoURL = URL.createObjectURL(photoFile);
  }
  incidents.push(newIncident);

  // marker
  const marker = L.marker([newIncident.lat, newIncident.lng]);
  markerClusterGroup.addLayer(marker);
  marker.on('click', () => showSidePanel(newIncident));

  // reset
  document.getElementById('issue-type').selectedIndex = 0;
  document.getElementById('photo-upload').value = '';
}

/***********************************************
 *  SIDE PANEL
 ***********************************************/
function showSidePanel(incident) {
  const votes = incidentsVotes[incident.id];
  let html = `
    <h3>${incident.type}</h3>
    <p><small>Reported: ${incident.time}</small></p>
  `;
  if (incident.photoURL) {
    html += `
      <img 
        src="${incident.photoURL}" 
        alt="Incident" 
        style="width:100%; max-height:200px; object-fit:cover;"
      />
    `;
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

function hideSidePanel() {
  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
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
 *  DYNAMIC DATE FILTER & STATS
 ***********************************************/

/** Build the #date-filter dropdown from the actual monthKeys present in incidentsData. */
function buildDateFilter() {
  const dateFilter = document.getElementById('date-filter');
  dateFilter.innerHTML = ''; // clear existing

  // get all monthKeys sorted descending
  const allMonthKeys = Object.keys(incidentsData).sort().reverse(); 
  // e.g. ["2024-12","2024-10","2024-09",...]

  allMonthKeys.forEach(mKey => {
    const option = document.createElement('option');
    option.value = mKey;
    // nice label, e.g. "2024-12" => "December 2024"
    option.textContent = formatMonthKey(mKey);
    dateFilter.appendChild(option);
  });
}

/** Format "YYYY-MM" => "MonthName YYYY", e.g. "2024-12" => "December 2024". */
function formatMonthKey(mKey) {
  const [y,m] = mKey.split('-');
  const monthNum = parseInt(m,10);
  const dateObj = new Date(parseInt(y,10), monthNum - 1);
  const monthName = dateObj.toLocaleString('default', { month: 'long' });
  return `${monthName} ${y}`;
}

function loadStatisticsData() {
  const dateVal = document.getElementById('date-filter').value;
  if (!dateVal || !incidentsData[dateVal]) {
    // no data for this month
    document.getElementById('stats-info').innerText = 'No data.';
    document.getElementById('sorted-incident-list').innerHTML = '';
    if (lineChart) lineChart.destroy();
    return;
  }

  // sum up total incidents for dateVal
  let total = 0;
  const typeCounts = incidentsData[dateVal]; // e.g. { "Brick Fall": 1, "Rubbish..":2 }
  for (let t in typeCounts) {
    total += typeCounts[t];
  }

  document.getElementById('stats-info').innerHTML =
    `${total} incidents were reported in ${formatMonthKey(dateVal)}.`;

  // sort highest to lowest
  const sorted = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]);
  let listHTML = '';
  sorted.forEach(([type,count]) => {
    listHTML += `
      <div 
        class="d-flex justify-content-between" 
        style="border-bottom:1px solid #ccc; padding:5px 0;"
      >
        <span>${type}</span>
        <strong>${count}</strong>
      </div>
    `;
  });
  document.getElementById('sorted-incident-list').innerHTML = listHTML;

  // line chart (just a placeholder example)
  const ctx = document.getElementById('line-chart').getContext('2d');
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [
        'Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'
      ],
      datasets: [
        {
          label: 'Incidents in ' + formatMonthKey(dateVal),
          data: Array(12).fill(0).map((_,i)=> i=== (parseInt(dateVal.split('-')[1],10)-1) ? total : 0),
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
