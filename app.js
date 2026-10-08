document.addEventListener('DOMContentLoaded', () => {
    // Global Chart.js styling to match editorial light design
    Chart.defaults.font.family = "'Plus Jakarta Sans', -apple-system, sans-serif";
    Chart.defaults.color = '#748076';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20, 31, 25, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#f5f6f2';
    Chart.defaults.plugins.tooltip.padding = 8;
    Chart.defaults.plugins.tooltip.cornerRadius = 4;

    let fullDataset = [];
    let filteredDataset = [];
    let recommendationsData = {};
    let activeCharts = {};

    // Load recommendations JSON & CSV
    Promise.all([
        fetch('recommendations.json').then(r => r.json()).catch(() => ({})),
        new Promise((resolve, reject) => {
            // First check if TeluguMovies_dataset.csv or movies.csv
            Papa.parse('movies.csv', {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: res => resolve(res.data),
                error: err => reject(err)
            });
        })
    ]).then(([recs, rawData]) => {
        recommendationsData = recs;

        fullDataset = rawData.map(d => {
            const movie = d.Movie ? String(d.Movie).trim() : '';
            const year = (d.Year && !isNaN(d.Year)) ? Math.floor(Number(d.Year)) : null;
            const cert = d.Certificate ? String(d.Certificate).trim() : 'UA';
            const genre = d.Genre ? String(d.Genre).trim() : 'Drama';
            const overview = d.Overview ? String(d.Overview).trim() : '';
            const runtime = (d.Runtime && !isNaN(d.Runtime)) ? Number(d.Runtime) : null;
            const rating = (d.Rating && !isNaN(d.Rating)) ? Number(d.Rating) : null;
            const votes = (d['No.of.Ratings'] && !isNaN(d['No.of.Ratings'])) ? Number(d['No.of.Ratings']) : 0;

            return {
                Movie: movie,
                Year: year,
                Certificate: cert,
                Genre: genre,
                Overview: overview,
                Runtime: runtime,
                Rating: rating,
                Votes: votes
            };
        }).filter(d => d.Movie.length > 0);

        filteredDataset = [...fullDataset];

        initDropdowns();
        setupFilterListeners();
        setupRecommender();
        setupModal();
        renderDashboard();
    }).catch(err => {
        console.error("Error loading dashboard data:", err);
    });

    // Populate Genre, Certificate, Year dropdowns
    function initDropdowns() {
        const genreSet = new Set();
        const certSet = new Set();
        const yearSet = new Set();

        fullDataset.forEach(d => {
            if (d.Genre) {
                d.Genre.split(',').forEach(g => {
                    const clean = g.trim();
                    if (clean) genreSet.add(clean);
                });
            }
            if (d.Certificate) certSet.add(d.Certificate);
            if (d.Year) yearSet.add(d.Year);
        });

        // Genres dropdown
        const genreSelect = document.getElementById('genre-select');
        Array.from(genreSet).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            genreSelect.appendChild(opt);
        });

        // Certificate dropdown
        const certSelect = document.getElementById('cert-select');
        Array.from(certSet).sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            certSelect.appendChild(opt);
        });

        // From Year & To Year dropdowns
        const sortedYears = Array.from(yearSet).sort((a, b) => a - b);
        const fromSelect = document.getElementById('from-year-select');
        const toSelect = document.getElementById('to-year-select');

        const minYear = sortedYears[0] || 1950;
        const maxYear = sortedYears[sortedYears.length - 1] || 2020;

        document.getElementById('archive-range-tag').textContent = `Film archive • ${minYear}–${maxYear}`;
        document.getElementById('year-range-meta').textContent = `${minYear}–${maxYear}`;

        sortedYears.forEach(y => {
            const opt1 = document.createElement('option');
            opt1.value = y;
            opt1.textContent = y;
            if (y === minYear) opt1.selected = true;
            fromSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = y;
            opt2.textContent = y;
            if (y === maxYear) opt2.selected = true;
            toSelect.appendChild(opt2);
        });
    }

    // Set up filter change listeners
    function setupFilterListeners() {
        const searchInput = document.getElementById('film-search-input');
        const genreSelect = document.getElementById('genre-select');
        const certSelect = document.getElementById('cert-select');
        const fromSelect = document.getElementById('from-year-select');
        const toSelect = document.getElementById('to-year-select');
        const ratingSlider = document.getElementById('rating-slider');
        const ratingDisplay = document.getElementById('rating-slider-display');
        const votesSlider = document.getElementById('votes-slider');
        const votesDisplay = document.getElementById('votes-slider-display');
        const resetBtn = document.getElementById('reset-all-btn');

        function applyFilters() {
            const search = searchInput.value.toLowerCase().trim();
            const genre = genreSelect.value;
            const cert = certSelect.value;
            const fromYear = parseInt(fromSelect.value) || 0;
            const toYear = parseInt(toSelect.value) || 9999;
            const minRating = parseFloat(ratingSlider.value) || 0;
            const minVotes = parseInt(votesSlider.value) || 0;

            ratingDisplay.textContent = minRating > 0 ? `${minRating.toFixed(1)}+` : '0.0+';
            votesDisplay.textContent = minVotes > 0 ? (minVotes >= 1000 ? `${Math.round(minVotes / 1000)}k+` : `${minVotes}+`) : 'Any';

            filteredDataset = fullDataset.filter(d => {
                if (search && !d.Movie.toLowerCase().includes(search) && !d.Overview.toLowerCase().includes(search)) return false;
                if (genre !== 'All' && !d.Genre.toLowerCase().includes(genre.toLowerCase())) return false;
                if (cert !== 'All' && d.Certificate !== cert) return false;
                if (d.Year && (d.Year < fromYear || d.Year > toYear)) return false;
                if (d.Rating !== null && d.Rating < minRating) return false;
                if (d.Votes < minVotes) return false;
                return true;
            });

            renderDashboard();
        }

        searchInput.addEventListener('input', applyFilters);
        genreSelect.addEventListener('change', applyFilters);
        certSelect.addEventListener('change', applyFilters);
        fromSelect.addEventListener('change', applyFilters);
        toSelect.addEventListener('change', applyFilters);
        ratingSlider.addEventListener('input', applyFilters);
        votesSlider.addEventListener('input', applyFilters);

        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            genreSelect.value = 'All';
            certSelect.value = 'All';
            if (fromSelect.options.length) fromSelect.selectedIndex = 0;
            if (toSelect.options.length) toSelect.selectedIndex = toSelect.options.length - 1;
            ratingSlider.value = 0;
            ratingDisplay.textContent = '0.0+';
            votesSlider.value = 0;
            votesDisplay.textContent = 'Any';
            filteredDataset = [...fullDataset];
            renderDashboard();
        });
    }

    // Modal logic
    function setupModal() {
        const modal = document.getElementById('team-modal');
        const openBtn = document.getElementById('team-info-btn');
        const closeBtn = document.getElementById('modal-close-btn');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => modal.classList.add('open'));
            closeBtn.addEventListener('click', () => modal.classList.remove('open'));
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.classList.remove('open');
            });
        }
    }

    // Recommendation System Logic
    function setupRecommender() {
        const select = document.getElementById('rec-movie-select');
        const container = document.getElementById('rec-results-container');

        // Populate recommender dropdown
        fullDataset.slice().sort((a, b) => a.Movie.localeCompare(b.Movie)).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.Movie;
            opt.textContent = `${m.Movie} (${m.Year || 'N/A'}) • ⭐ ${m.Rating || 'N/A'}`;
            select.appendChild(opt);
        });

        // Default to Bahubali or first film
        const defaultFilm = fullDataset.find(m => m.Movie.includes('Bahubali')) || fullDataset[0];
        if (defaultFilm) select.value = defaultFilm.Movie;

        function renderRecommendations(title) {
            const recs = recommendationsData[title] || [];
            if (!recs.length) {
                container.innerHTML = '<p style="color: #748076; font-size: 0.85rem;">No recommendations generated for this title.</p>';
                return;
            }

            container.innerHTML = recs.map(r => `
                <div class="rec-tile">
                    <div>
                        <div class="rec-tile-header">
                            <span class="rec-tile-title">${r.movie}</span>
                            <span class="rec-similarity-tag">${r.similarity_percent}% Match</span>
                        </div>
                        <div class="rec-tile-genre">${r.genre}</div>
                        <div class="rec-tile-desc">${r.overview || 'Overview unavailable'}</div>
                    </div>
                    <div class="rec-tile-meta">
                        <span>Year: ${r.year || 'N/A'}</span>
                        <span style="font-weight: 700; color: #1b6b55;">⭐ ${r.rating || 'N/A'}</span>
                    </div>
                </div>
            `).join('');
        }

        select.addEventListener('change', () => {
            if (select.value) renderRecommendations(select.value);
        });

        if (defaultFilm) renderRecommendations(defaultFilm.Movie);
    }

    // Render all dashboard visuals
    function renderDashboard() {
        updateKPIs();
        renderMoviesByYearChart();
        renderTopGenresChart();
        renderRatingDistChart();
        renderRuntimeRatingChart();
        renderArchiveTable();
    }

    // 1. KPI Calculation & Formatting
    function updateKPIs() {
        const count = filteredDataset.length;
        const totalUnique = fullDataset.length;
        
        document.getElementById('kpi-unique-count').textContent = count.toLocaleString();
        document.getElementById('kpi-unique-sub').textContent = `of ${totalUnique.toLocaleString()} unique titles`;

        const rated = filteredDataset.filter(d => d.Rating !== null);
        const avgRating = rated.length ? (rated.reduce((s, d) => s + d.Rating, 0) / rated.length).toFixed(2) : '0.00';
        document.getElementById('kpi-avg-rating').textContent = avgRating;

        const timed = filteredDataset.filter(d => d.Runtime !== null);
        const avgRuntime = timed.length ? (timed.reduce((s, d) => s + d.Runtime, 0) / timed.length).toFixed(2) : '0.00';
        document.getElementById('kpi-avg-runtime').textContent = avgRuntime;

        const totalVotes = filteredDataset.reduce((s, d) => s + (d.Votes || 0), 0);
        document.getElementById('kpi-total-votes').textContent = totalVotes.toLocaleString();
    }

    // Helper to get or recreate Chart
    function createChart(canvasId, type, config) {
        if (activeCharts[canvasId]) {
            activeCharts[canvasId].destroy();
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        activeCharts[canvasId] = new Chart(ctx, { type, ...config });
        return activeCharts[canvasId];
    }

    // 2. Chart 1: Movies by Year (Vertical Histogram / Bar Chart with peak highlight)
    function renderMoviesByYearChart() {
        const yearMap = {};
        filteredDataset.forEach(d => {
            if (d.Year) yearMap[d.Year] = (yearMap[d.Year] || 0) + 1;
        });

        const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
        const counts = years.map(y => yearMap[y]);

        // Find peak year for red highlight bar
        let maxVal = -1;
        let peakYear = null;
        years.forEach(y => {
            if (yearMap[y] > maxVal) {
                maxVal = yearMap[y];
                peakYear = y;
            }
        });

        // Colors: deep teal `#1b6b55`, peak bar in coral red `#e04838`
        const barColors = years.map(y => (y === peakYear ? '#e04838' : '#1b6b55'));

        createChart('moviesByYearCanvas', 'bar', {
            data: {
                labels: years,
                datasets: [{
                    data: counts,
                    backgroundColor: barColors,
                    borderRadius: 2,
                    barPercentage: 0.9,
                    categoryPercentage: 0.95
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: items => `Year ${items[0].label}`,
                            label: ctx => ` Films released: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Year',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { top: 8 }
                        },
                        grid: { display: false },
                        ticks: {
                            color: '#748076',
                            maxTicksLimit: 8,
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Films',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { bottom: 8 }
                        },
                        beginAtZero: true,
                        grid: { color: '#eef1ec' },
                        ticks: {
                            color: '#748076',
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    }
                }
            }
        });
    }

    // 3. Chart 2: Top Genres (Horizontal Bar Chart with top bar red highlight & count labels)
    function renderTopGenresChart() {
        const genreMap = {};
        filteredDataset.forEach(d => {
            if (d.Genre) {
                d.Genre.split(',').forEach(g => {
                    const clean = g.trim();
                    if (clean) genreMap[clean] = (genreMap[clean] || 0) + 1;
                });
            }
        });

        const sortedGenres = Object.entries(genreMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8); // Top 8 genres like screenshot

        const labels = sortedGenres.map(g => g[0]);
        const values = sortedGenres.map(g => g[1]);

        // Top bar red `#e04838`, other bars teal `#1b6b55`
        const colors = values.map((v, i) => (i === 0 ? '#e04838' : '#1b6b55'));

        createChart('topGenresCanvas', 'bar', {
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 3,
                    barPercentage: 0.75
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` Films tagged: ${ctx.parsed.x}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Number of Films',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { top: 8 }
                        },
                        beginAtZero: true,
                        grid: { color: '#eef1ec' },
                        ticks: {
                            color: '#748076',
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Genre',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { bottom: 8 }
                        },
                        grid: { display: false },
                        ticks: {
                            color: '#141f19',
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    }

    // 4. Chart 3: Rating Distribution (Warm Amber Histogram)
    function renderRatingDistChart() {
        // 10 Bins: 0-1, 1-2, 2-3, 3-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10
        const binCounts = Array(10).fill(0);
        const binLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

        filteredDataset.forEach(d => {
            if (d.Rating !== null && !isNaN(d.Rating)) {
                const idx = Math.min(Math.floor(d.Rating), 9);
                binCounts[idx]++;
            }
        });

        createChart('ratingDistCanvas', 'bar', {
            data: {
                labels: binLabels,
                datasets: [{
                    data: binCounts,
                    backgroundColor: '#e5a93b',
                    borderRadius: 2,
                    barPercentage: 0.95,
                    categoryPercentage: 0.98
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: items => `Rating Interval: ${items[0].label - 1} - ${items[0].label}`,
                            label: ctx => ` Movies count: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Rating (out of 10)',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { top: 8 }
                        },
                        grid: { display: false },
                        ticks: {
                            color: '#748076',
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Films',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { bottom: 8 }
                        },
                        beginAtZero: true,
                        grid: { color: '#eef1ec' },
                        ticks: {
                            color: '#748076',
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    }
                }
            }
        });
    }

    // 5. Chart 4: Runtime vs Rating (Scatter Plot)
    function renderRuntimeRatingChart() {
        const scatterPoints = [];
        const pointColors = [];

        filteredDataset.forEach(d => {
            if (d.Runtime !== null && d.Rating !== null) {
                scatterPoints.push({
                    x: d.Runtime,
                    y: d.Rating,
                    title: d.Movie,
                    votes: d.Votes
                });
                // Highlight high-rated films (>= 7.8) in red coral, others in deep teal
                if (d.Rating >= 7.8) {
                    pointColors.push('rgba(224, 72, 56, 0.75)');
                } else {
                    pointColors.push('rgba(27, 107, 85, 0.55)');
                }
            }
        });

        createChart('runtimeRatingCanvas', 'scatter', {
            data: {
                datasets: [{
                    data: scatterPoints,
                    backgroundColor: pointColors,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const p = ctx.raw;
                                return `${p.title}: ⭐ ${p.y} (${p.x} mins, ${p.votes.toLocaleString()} votes)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Runtime (minutes)',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { top: 8 }
                        },
                        grid: { color: '#eef1ec' },
                        ticks: {
                            color: '#748076',
                            stepSize: 25,
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'IMDb Rating',
                            color: '#3a4a3f',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '600' },
                            padding: { bottom: 8 }
                        },
                        min: 0,
                        max: 10,
                        grid: { color: '#eef1ec' },
                        ticks: {
                            color: '#748076',
                            stepSize: 2,
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        }
                    }
                }
            }
        });
    }

    // 6. Data Explorer Table
    function renderArchiveTable() {
        const tbody = document.getElementById('archive-table-body');
        const countMeta = document.getElementById('table-entries-meta');
        if (!tbody) return;

        countMeta.textContent = `Showing ${filteredDataset.length} films`;

        tbody.innerHTML = filteredDataset.slice(0, 50).map(d => {
            const isHigh = d.Rating && d.Rating >= 7.8;
            return `
                <tr>
                    <td><strong>${d.Movie}</strong></td>
                    <td style="font-family: var(--font-mono);">${d.Year || '—'}</td>
                    <td>${d.Genre || '—'}</td>
                    <td><span style="font-size: 0.75rem; background: #eef1ec; padding: 2px 6px; border-radius: 3px;">${d.Certificate || 'UA'}</span></td>
                    <td style="font-family: var(--font-mono);">${d.Runtime ? d.Runtime + 'm' : '—'}</td>
                    <td class="rating-badge-cell ${isHigh ? 'rating-high' : ''}">⭐ ${d.Rating ? d.Rating.toFixed(1) : '—'}</td>
                    <td style="font-family: var(--font-mono); color: #748076;">${d.Votes ? d.Votes.toLocaleString() : '0'}</td>
                </tr>
            `;
        }).join('');
    }
});
