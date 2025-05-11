const DATA_URL = 'data/energy.json';

// State
let data = [];
let state = {
  year: '1980',
  category: 'Gross consumption',
  selectedCarriers: []
};

// DOM 
const yearSel = document.getElementById('yearSelect');
const catSel = document.getElementById('categorySelect');
const carrierButtonsContainer = document.getElementById('carrierButtons');
const grossSpan = document.getElementById('grossConsumption');
const endSpan = document.getElementById('endConsumption');
const themeBtn = document.getElementById('themeToggle');

// Theme Toggle
function updateThemeButtonText() {
  themeBtn.textContent = document.body.classList.contains('dark') ? 'Light' : 'Dark';
}

themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeButtonText();
});

// Carrier Color Palette
const CARRIER_COLORS = [
  '#4f8cff', '#e67e22', '#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f', '#16a085', '#34495e',
  '#ff6f61', '#7f8c8d', '#1abc9c', '#d35400', '#8e44ad', '#27ae60', '#c0392b'
];
function getCarrierColor(carrier) {
  let hash = 0;
  for (let i = 0; i < carrier.length; i++) hash = carrier.charCodeAt(i) + ((hash << 5) - hash);
  return CARRIER_COLORS[Math.abs(hash) % CARRIER_COLORS.length];
}

// Chart
let trendChart;

// Init
init();
async function init() {
  data = await (await fetch(DATA_URL)).json();
  data = data.map(r => ({ ...r, TJ: r.TJ === '' ? null : Number(r.TJ) }));
  populateFilters();
  setupCharts();
  render();
  addEvents();

  // Set initial theme from localStorage if present
  const savedTheme = localStorage.getItem('theme');
  document.body.classList.toggle('dark', savedTheme === 'dark');
  updateThemeButtonText();

  // Hamburger menu for carrier buttons (mobile)
  const carrierMenuToggle = document.getElementById('carrierMenuToggle');
  const carrierButtons = document.getElementById('carrierButtons');
  const carrierMenuLabel = document.getElementById('carrierMenuLabel');
  if (carrierMenuToggle && carrierButtons) {
    carrierMenuToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        carrierButtons.classList.toggle('open');
        if (carrierMenuLabel) {
          carrierMenuLabel.classList.toggle('hide', carrierButtons.classList.contains('open'));
        }
      }
    });
  }
}

// Filter UI
function populateFilters() {
  const years = [...new Set(data.map(d => d.Year))].sort();
  yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('');

  const cats = [...new Set(data.map(d => d.Category))].sort();
  catSel.innerHTML = cats.map(c => `<option value="${c}" ${c === state.category ? 'selected' : ''}>${c}</option>`).join('');

  const endConsumptionTotalData = data.filter(d => d.Category === 'End consumption - total');
  const carrierTotals = {};
  const allCarriers = [...new Set(endConsumptionTotalData.map(d => d['Energy Carrier']))]
    .filter(carrier => carrier && !['Core fuel', 'crude oil', 'Hydropower'].includes(carrier));
  allCarriers.forEach(carrier => {
    carrierTotals[carrier] = sumTJ(d => d.Category === 'End consumption - total' && d['Energy Carrier'] === carrier);
  });
  const sortedCarriers = Object.keys(carrierTotals).sort((a, b) => carrierTotals[b] - carrierTotals[a]);

  carrierButtonsContainer.innerHTML = sortedCarriers.map(carrier =>
    `<button class="carrier-button ${state.selectedCarriers.includes(carrier) ? 'selected' : ''}" data-carrier="${carrier}">${carrier}</button>`
  ).join('');

  if (sortedCarriers.length > 0 && state.selectedCarriers.length === 0) {
    state.selectedCarriers = [sortedCarriers[0]];
    const firstButton = carrierButtonsContainer.querySelector(`[data-carrier="${sortedCarriers[0]}"]`);
    if (firstButton) firstButton.classList.add('selected');
  }
}

// Event Listeners
function addEvents() {
  yearSel.addEventListener('change', e => { state.year = e.target.value; render(); });
  catSel.addEventListener('change', e => { state.category = e.target.value; render(); });
  carrierButtonsContainer.addEventListener('click', e => {
    if (e.target.classList.contains('carrier-button')) {
      const carrier = e.target.dataset.carrier;
      if (state.selectedCarriers.includes(carrier)) {
        state.selectedCarriers = state.selectedCarriers.filter(c => c !== carrier);
        e.target.classList.remove('selected');
      } else {
        state.selectedCarriers.push(carrier);
        e.target.classList.add('selected');
      }
      if (state.selectedCarriers.length === 0 && carrier) {
        state.selectedCarriers = [carrier];
        e.target.classList.add('selected');
      }
      render();
    }
  });
}

// Utility
function sumTJ(fn) {
  return data.filter(fn).reduce((s, r) => s + (r.TJ ?? 0), 0);
}

// Chart Setup
function setupCharts() {
  const ctxTrend = document.getElementById('trendChart').getContext('2d');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  trendChart = new Chart(ctxTrend, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: state.selectedCarriers.length > 0 ? `Trend for ${state.selectedCarriers.join(', ')}` : 'Select an Energy Carrier'
        },
        tooltip: { mode: 'index', intersect: false },
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: isMobile ? 14 : 22,
            boxHeight: isMobile ? 8 : 12,
            borderRadius: isMobile ? 4 : 6,
            font: { size: isMobile ? 11 : 16, weight: isMobile ? '500' : 'bold', family: 'Inter, Roboto, sans-serif' },
            padding: isMobile ? 6 : 18,
            color: '#2c3e50',
            usePointStyle: true
          },
          align: 'center',
          maxHeight: isMobile ? 30 : 60
        }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Year' } },
        y: { title: { display: true, text: 'TJ'} }
      }
    }
  });
}

// Render
function render() {
  const grossTotalYear = sumTJ(d => d.Year === state.year && d.Category === 'Gross consumption');
  const endTotal = sumTJ(d => d.Year === state.year && d.Category === 'End consumption - total');
  grossSpan.textContent = grossTotalYear !== null ? grossTotalYear.toLocaleString() : '--';
  endSpan.textContent = endTotal !== null ? endTotal.toLocaleString() : '--';

  const years = [...new Set(data.map(d => d.Year))].sort();
  trendChart.data.labels = years;
  trendChart.data.datasets = state.selectedCarriers.map(carrier => {
    const dataPoints = years.map(year => sumTJ(d => d.Year === year && d.Category === 'End consumption - total' && d['Energy Carrier'] === carrier));
    const color = getCarrierColor(carrier);
    return {
      label: carrier,
      data: dataPoints,
      fill: false,
      borderColor: color,
      backgroundColor: color,
      tension: 0.3,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: dataPoints.map((_, index) => years[index] === state.year ? 5 : 0),
      pointHoverRadius: 5,
      pointHitRadius: 10,
    };
  });
  trendChart.options.plugins.title.text = state.selectedCarriers.length > 0 ? `Trend for ${state.selectedCarriers.join(', ')}` : 'Select an Energy Carrier';
  trendChart.update();
}
