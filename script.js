// Global database variable
let db;
let ratingChart = null;

// Initialize the database connection when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing database connection...');
    
    // Initialize sql.js and load the database
    initDatabase();
});

async function initDatabase() {
    try {
        // Initialize sql.js
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        console.log('SQL.js initialized successfully');
        
        // Load the database file
        const response = await fetch('storage.db');
        const arrayBuffer = await response.arrayBuffer();
        
        // Create database instance
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        
        console.log('Database loaded successfully');
        
        // Load and display the rankings data
        loadRankingsData();
        
    } catch (error) {
        console.error('Error loading database:', error);
        document.getElementById('activeRankingsTable').innerHTML = 
            '<tr><td colspan="9" style="text-align: center; color: red;">Error loading database</td></tr>';
        document.getElementById('allRankingsTable').innerHTML = 
            '<tr><td colspan="10" style="text-align: center; color: red;">Error loading database</td></tr>';
    }
}

function loadRankingsData() {
    try {
        // Get total players count
        const playersResult = db.exec("SELECT COUNT(*) as count FROM player_ratings WHERE (wins + losses) >= 5");
        const totalPlayers = playersResult[0]?.values[0]?.[0] || 0;
        document.getElementById('totalPlayers').textContent = totalPlayers;
        
        // Get total matches count
        const matchesResult = db.exec("SELECT COUNT(*) as count FROM match WHERE player_1_score IS NOT NULL AND player_2_score IS NOT NULL");
        const totalMatches = matchesResult[0]?.values[0]?.[0] || 0;
        document.getElementById('totalMatches').textContent = totalMatches;
        
        // Get current season
        const seasonResult = db.exec("SELECT MAX(season) as current_season FROM match");
        const currentSeason = seasonResult[0]?.values[0]?.[0] || 'N/A';
        document.getElementById('currentSeason').textContent = currentSeason;
        
        // Get active players (who played in the current season)
        const activePlayersQuery = `
            SELECT 
                pr.name,
                pr.rating,
                pr.wins,
                pr.losses,
                CASE 
                    WHEN (pr.wins + pr.losses) > 0 
                    THEN (pr.wins * 100.0) / (pr.wins + pr.losses)
                    ELSE 0 
                END as win_percentage,
                pr.points_for,
                pr.points_against
            FROM player_ratings pr
            WHERE EXISTS (
                SELECT 1 
                FROM match m 
                WHERE (m.player_1_id = pr.player_id OR m.player_2_id = pr.player_id)
                AND m.season = (SELECT MAX(season) FROM match)
            )
            AND (pr.wins + pr.losses) >= 5
            ORDER BY pr.rating DESC
        `;
        
        const activePlayersResult = db.exec(activePlayersQuery);
        
        if (activePlayersResult.length > 0 && activePlayersResult[0].values.length > 0) {
            displayRankings(activePlayersResult[0].values, 'activeRankingsTable');
        } else {
            document.getElementById('activeRankingsTable').innerHTML = 
                '<tr><td colspan="9" style="text-align: center;">No active players found.</td></tr>';
        }
        
        // Get all players rankings
        const allPlayersQuery = `
            SELECT 
                pr.name,
                pr.rating,
                pr.wins,
                pr.losses,
                CASE 
                    WHEN (pr.wins + pr.losses) > 0 
                    THEN (pr.wins * 100.0) / (pr.wins + pr.losses)
                    ELSE 0 
                END as win_percentage,
                pr.points_for,
                pr.points_against,
                COALESCE((
                    SELECT MAX(prh.season) 
                    FROM player_rating_history prh 
                    WHERE prh.name = pr.name AND prh.matches > 0
                ), 0) as last_season
            FROM player_ratings pr
            WHERE (pr.wins + pr.losses) >= 5
            ORDER BY pr.rating DESC
        `;
        
        const allPlayersResult = db.exec(allPlayersQuery);
        
        if (allPlayersResult.length > 0 && allPlayersResult[0].values.length > 0) {
            displayRankings(allPlayersResult[0].values, 'allRankingsTable');
        } else {
            document.getElementById('allRankingsTable').innerHTML = 
                '<tr><td colspan="10" style="text-align: center;">No rankings data found. Run the Python script to calculate ratings.</td></tr>';
        }
        
        // Create the rating progression chart
        createRatingChart();
        
        // Populate the prediction tool dropdowns
        populatePredictionDropdowns();
        
        // Calculate and display accuracy metrics
        calculateAccuracyMetrics();
        
        // Calculate and display biggest upsets and misses
        calculateBiggestUpsets();
        calculateBiggestMisses();
        calculatePerfectPredictions();
        
    } catch (error) {
        console.error('Error loading rankings data:', error);
        document.getElementById('activeRankingsTable').innerHTML = 
            '<tr><td colspan="9" style="text-align: center; color: red;">Error loading rankings data</td></tr>';
        document.getElementById('allRankingsTable').innerHTML = 
            '<tr><td colspan="10" style="text-align: center; color: red;">Error loading rankings data</td></tr>';
    }
}

function createRatingChart() {
    try {
        // Get current season first
        const seasonResult = db.exec("SELECT MAX(season) as current_season FROM match");
        const currentSeason = seasonResult[0]?.values[0]?.[0] || 7;
        
        // Get active players (who played in the current season) with their rating history
        const chartQuery = `
            SELECT prh.name, prh.season, prh.rating 
            FROM player_rating_history prh
            WHERE prh.matches > 0 
            AND prh.name IN (
                SELECT DISTINCT name 
                FROM player_rating_history 
                WHERE season = ${currentSeason} AND matches > 0
            )
            ORDER BY prh.name, prh.season
        `;
        
        const chartResult = db.exec(chartQuery);
        
        if (chartResult.length === 0 || chartResult[0].values.length === 0) {
            console.log('No chart data available for active players');
            return;
        }
        
        // Process the data for Chart.js
        const playerData = {};
        const seasons = new Set();
        
        chartResult[0].values.forEach(row => {
            const [name, season, rating] = row;
            if (!playerData[name]) {
                playerData[name] = {};
            }
            playerData[name][season] = Math.round(rating);
            seasons.add(season);
        });
        
        // Convert to sorted arrays
        const sortedSeasons = Array.from(seasons).sort((a, b) => a - b);
        const sortedPlayers = Object.keys(playerData).sort();
        
        // Generate colors for each player
        const colors = generateColors(sortedPlayers.length);
        
        // Create datasets for Chart.js
        const datasets = sortedPlayers.map((player, index) => {
            const data = sortedSeasons.map(season => {
                return playerData[player][season] || null;
            });
            
            return {
                label: player,
                data: data,
                borderColor: colors[index],
                backgroundColor: colors[index] + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            };
        });
        
        // Create the chart
        const ctx = document.getElementById('ratingChart').getContext('2d');
        
        if (ratingChart) {
            ratingChart.destroy();
        }
        
        ratingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedSeasons.map(s => `Season ${s}`),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Active Players Rating Progression Over Seasons'
                    },
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    tooltip: {
                        mode: 'nearest',
                        intersect: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Rating'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Season'
                        }
                    }
                },
                interaction: {
                    intersect: true,
                    mode: 'nearest'
                }
            }
        });
        
    } catch (error) {
        console.error('Error creating rating chart:', error);
    }
}

function generateColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
        '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384', '#36A2EB',
        '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384',
        '#C9CBCF', '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
    ];
    
    // If we need more colors, generate them
    while (colors.length < count) {
        const hue = Math.random() * 360;
        const saturation = 70 + Math.random() * 30;
        const lightness = 50 + Math.random() * 20;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return colors.slice(0, count);
}

function displayRankings(rankings, tableId) {
    const tbody = document.getElementById(tableId);
    tbody.innerHTML = '';
    
    // Get current season for comparison
    const currentSeason = parseInt(document.getElementById('currentSeason').textContent) || 7;
    
    rankings.forEach((row, index) => {
        const [name, rating, wins, losses, winPercentage, pointsFor, pointsAgainst, lastSeason] = row;
        
        let tr = document.createElement('tr');
        
        if (tableId === 'allRankingsTable') {
            // All Players table - include Last Seen column
            // Determine season styling based on recency
            let seasonClass = '';
            let seasonText = lastSeason > 0 ? `Season ${lastSeason}` : 'Never';
            
            if (lastSeason === currentSeason) {
                seasonClass = 'season-current';
            } else if (lastSeason === currentSeason - 1) {
                seasonClass = 'season-recent';
            } else if (lastSeason >= currentSeason - 2) {
                seasonClass = 'season-older';
            } else {
                seasonClass = 'season-old';
            }
            
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${name}</td>
                <td>${Math.round(rating)}</td>
                <td>${wins}</td>
                <td>${losses}</td>
                <td>${Math.round(winPercentage)}%</td>
                <td>${pointsFor}</td>
                <td>${pointsAgainst}</td>
                <td class="${seasonClass}">${seasonText}</td>
                <td><button class="history-btn" data-player="${name}">History</button></td>
            `;
        } else {
            // Active Players table - no Last Seen column
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${name}</td>
                <td>${Math.round(rating)}</td>
                <td>${wins}</td>
                <td>${losses}</td>
                <td>${Math.round(winPercentage)}%</td>
                <td>${pointsFor}</td>
                <td>${pointsAgainst}</td>
                <td><button class="history-btn" data-player="${name}">History</button></td>
            `;
        }
        
        tbody.appendChild(tr);
    });

    // Add event listeners for history buttons in this table
    tbody.querySelectorAll('.history-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const playerName = this.getAttribute('data-player');
            showPlayerHistory(playerName);
        });
    });
}

function showPlayerHistory(playerName) {
    try {
        console.log('Loading history for player:', playerName);
        
        // Query the player_rating_history table for this player using db.exec()
        const historyQuery = `
            SELECT season, rating, wins, losses, points_for, points_against, matches 
            FROM player_rating_history 
            WHERE name = '${playerName.replace(/'/g, "''")}' 
            AND matches > 0
            ORDER BY season ASC
        `;
        
        console.log('Executing query:', historyQuery);
        const historyResult = db.exec(historyQuery);
        console.log('Query result:', historyResult);
        
        if (historyResult.length > 0 && historyResult[0].values.length > 0) {
            document.getElementById('historyModalTitle').textContent = `History for ${playerName}`;
            let html = `<table>
                <thead><tr>
                    <th>Season</th>
                    <th>Rating</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Points For</th>
                    <th>Points Against</th>
                    <th>Matches</th>
                </tr></thead><tbody>`;
            
            historyResult[0].values.forEach(row => {
                const [season, rating, wins, losses, pointsFor, pointsAgainst, matches] = row;
                html += `<tr>
                    <td>${season}</td>
                    <td>${Math.round(rating)}</td>
                    <td>${wins}</td>
                    <td>${losses}</td>
                    <td>${pointsFor}</td>
                    <td>${pointsAgainst}</td>
                    <td>${matches}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            document.getElementById('historyModalContent').innerHTML = html;
        } else {
            document.getElementById('historyModalTitle').textContent = `No history for ${playerName}`;
            document.getElementById('historyModalContent').innerHTML = '<p>No season-by-season data found.</p>';
        }
        
        const modal = document.getElementById('historyModal');
        modal.classList.remove('hide');
        modal.classList.add('show');
        
        // Ensure close button functionality is attached
        setupModalClose(modal);
        
    } catch (error) {
        console.error('Error loading player history:', error);
        document.getElementById('historyModalTitle').textContent = `Error loading history for ${playerName}`;
        document.getElementById('historyModalContent').innerHTML = '<p>Error loading player history.</p>';
        const modal = document.getElementById('historyModal');
        modal.classList.remove('hide');
        modal.classList.add('show');
    }
}

function setupModalClose(modal) {
    const closeBtn = document.getElementById('closeHistoryModal');
    
    // Remove any existing event listeners
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    // Add click event listener to close button
    newCloseBtn.addEventListener('click', () => {
        modal.classList.add('hide');
        modal.classList.remove('show');
    });
    
    // Add click event listener to modal background
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hide');
            modal.classList.remove('show');
        }
    });
    
    // Add escape key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            modal.classList.add('hide');
            modal.classList.remove('show');
        }
    });
}

function populatePredictionDropdowns() {
    try {
        // Get all players for the dropdowns
        const playersQuery = `
            SELECT name, rating 
            FROM player_ratings 
            WHERE (wins + losses) >= 5
            ORDER BY name
        `;
        
        const playersResult = db.exec(playersQuery);
        
        if (playersResult.length > 0 && playersResult[0].values.length > 0) {
            const player1Select = document.getElementById('player1Select');
            const player2Select = document.getElementById('player2Select');
            
            // Clear existing options (except the first placeholder)
            player1Select.innerHTML = '<option value="">Select a player...</option>';
            player2Select.innerHTML = '<option value="">Select a player...</option>';
            
            // Add player options
            playersResult[0].values.forEach(row => {
                const [name, rating] = row;
                const option1 = document.createElement('option');
                option1.value = name;
                option1.textContent = `${name} (${Math.round(rating)})`;
                player1Select.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = name;
                option2.textContent = `${name} (${Math.round(rating)})`;
                player2Select.appendChild(option2);
            });
            
            // Add event listener for prediction button
            document.getElementById('predictBtn').addEventListener('click', predictMatch);
        }
        
    } catch (error) {
        console.error('Error populating prediction dropdowns:', error);
    }
}

function predictMatch() {
    try {
        const player1Name = document.getElementById('player1Select').value;
        const player2Name = document.getElementById('player2Select').value;
        
        if (!player1Name || !player2Name) {
            alert('Please select both players');
            return;
        }
        
        if (player1Name === player2Name) {
            alert('Please select two different players');
            return;
        }
        
        // Get player ratings
        const ratingQuery = `
            SELECT name, rating 
            FROM player_ratings 
            WHERE name IN ('${player1Name.replace(/'/g, "''")}', '${player2Name.replace(/'/g, "''")}')
        `;
        
        const ratingResult = db.exec(ratingQuery);
        
        if (ratingResult.length === 0 || ratingResult[0].values.length < 2) {
            alert('Error: Could not find player ratings');
            return;
        }
        
        // Find the ratings for each player
        let player1Rating = 0;
        let player2Rating = 0;
        
        ratingResult[0].values.forEach(row => {
            const [name, rating] = row;
            if (name === player1Name) {
                player1Rating = rating;
            } else if (name === player2Name) {
                player2Rating = rating;
            }
        });
        
        // Calculate predicted scores using the same algorithm as your Python script
        const expectedRating1 = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400));
        const expectedRating2 = 1 / (1 + Math.pow(10, (player1Rating - player2Rating) / 400));
        
        // Calculate expected scores (winner scores 21 points)
        let expectedScore1, expectedScore2;
        if (expectedRating1 > expectedRating2) {
            expectedScore1 = 21;
            expectedScore2 = 21 * (expectedRating2 / expectedRating1);
        } else {
            expectedScore2 = 21;
            expectedScore1 = 21 * (expectedRating1 / expectedRating2);
        }
        
        // Round to nearest tenth
        const roundedScore1 = Math.round(expectedScore1 * 10) / 10;
        const roundedScore2 = Math.round(expectedScore2 * 10) / 10;
        
        // Display the result
        const resultDiv = document.getElementById('predictionResult');
        const scoreDiv = document.getElementById('predictionScore');
        
        scoreDiv.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <div>
                    <div style="font-size: 16px; color: #666;">${player1Name}</div>
                    <div style="font-size: 32px; color: #007bff;">${roundedScore1}</div>
                </div>
                <div style="font-size: 24px; color: #666;">-</div>
                <div>
                    <div style="font-size: 16px; color: #666;">${player2Name}</div>
                    <div style="font-size: 32px; color: #007bff;">${roundedScore2}</div>
                </div>
            </div>
        `;
        
        resultDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Error predicting match:', error);
        alert('Error calculating prediction');
    }
}

function calculateAccuracyMetrics() {
    try {
        // Get all matches with player names and scores
        const matchesQuery = `
            SELECT 
                m.player_1_score, m.player_2_score,
                p1.first_name || ' ' || p1.last_name as player1_name,
                p2.first_name || ' ' || p2.last_name as player2_name
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            ORDER BY m.id
        `;
        
        const matchesResult = db.exec(matchesQuery);
        
        if (matchesResult.length === 0 || matchesResult[0].values.length === 0) {
            console.log('No match data available for accuracy calculation');
            return;
        }
        
        // Initialize accuracy tracking variables
        let correctPredictions = 0;
        let totalPredictions = 0;
        let exactScorePredictions = 0;
        let within3Points = 0;
        let within5Points = 0;
        let within10Points = 0;
        let within15Points = 0;
        let outside15Points = 0;
        
        // Process each match to calculate accuracy
        matchesResult[0].values.forEach((match, index) => {
            const [score1, score2, player1Name, player2Name] = match;
            
            // Skip matches with invalid scores
            try {
                const player1Score = parseInt(score1);
                const player2Score = parseInt(score2);
                
                if (isNaN(player1Score) || isNaN(player2Score)) {
                    return;
                }
            } catch (e) {
                return;
            }
            
            // Get player ratings at the time of this match
            // For simplicity, we'll use current ratings, but ideally we'd use historical ratings
            const player1RatingQuery = `
                SELECT rating FROM player_ratings 
                WHERE name = '${player1Name.replace(/'/g, "''")}'
            `;
            const player2RatingQuery = `
                SELECT rating FROM player_ratings 
                WHERE name = '${player2Name.replace(/'/g, "''")}'
            `;
            
            const player1RatingResult = db.exec(player1RatingQuery);
            const player2RatingResult = db.exec(player2RatingQuery);
            
            // Use current ratings if available, otherwise use default 1500
            const player1Rating = player1RatingResult.length > 0 ? player1RatingResult[0].values[0][0] : 1500;
            const player2Rating = player2RatingResult.length > 0 ? player2RatingResult[0].values[0][0] : 1500;
            
            // Calculate expected scores using the same algorithm as the Python script
            const expectedRating1 = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400));
            const expectedRating2 = 1 / (1 + Math.pow(10, (player1Rating - player2Rating) / 400));
            
            let predictedScore1, predictedScore2;
            if (expectedRating1 > expectedRating2) {
                predictedScore1 = 21;
                predictedScore2 = 21 * (expectedRating2 / expectedRating1);
            } else {
                predictedScore2 = 21;
                predictedScore1 = 21 * (expectedRating1 / expectedRating2);
            }
            
            // Round predictions to nearest integer
            predictedScore1 = Math.round(predictedScore1);
            predictedScore2 = Math.round(predictedScore2);
            
            // Check if winner prediction was correct
            const actualWinner = score1 > score2 ? player1Name : player2Name;
            const predictedWinner = predictedScore1 > predictedScore2 ? player1Name : player2Name;
            
            if (actualWinner === predictedWinner) {
                correctPredictions++;
            }
            totalPredictions++;
            
            // Check score prediction accuracy
            const actualDiff = Math.abs(score1 - score2);
            const predictedDiff = Math.abs(predictedScore1 - predictedScore2);
            const scoreDifference = Math.abs(actualDiff - predictedDiff);
            
            if (scoreDifference === 0) {
                exactScorePredictions++;
            }
            if (scoreDifference <= 3) {
                within3Points++;
            }
            if (scoreDifference <= 5) {
                within5Points++;
            }
            if (scoreDifference <= 10) {
                within10Points++;
            }
            if (scoreDifference <= 15) {
                within15Points++;
            } else {
                outside15Points++;
            }
        });
        
        // Calculate percentages
        const accuracyPercentage = totalPredictions > 0 ? (correctPredictions / totalPredictions * 100).toFixed(1) : 0;
        const exactPercentage = totalPredictions > 0 ? (exactScorePredictions / totalPredictions * 100).toFixed(1) : 0;
        const within3Percentage = totalPredictions > 0 ? ((within3Points - exactScorePredictions) / totalPredictions * 100).toFixed(1) : 0;
        const within5Percentage = totalPredictions > 0 ? ((within5Points - within3Points) / totalPredictions * 100).toFixed(1) : 0;
        
        // Update the UI with exclusive ranges (non-cumulative)
        document.getElementById('accuracyMetric').textContent = `${accuracyPercentage}%`;
        document.getElementById('exactPredictions').textContent = `${exactPercentage}%`;
        document.getElementById('within3Points').textContent = `${within3Percentage}%`;
        document.getElementById('within5Points').textContent = `${within5Percentage}%`;
        
        // Create distribution chart
        const distributionDiv = document.getElementById('predictionDistribution');
        distributionDiv.innerHTML = '';
        
        const distributionData = [
            { label: 'Exact', count: exactScorePredictions, percentage: exactPercentage, color: '#28a745' },
            { label: '1-3 Points', count: within3Points - exactScorePredictions, percentage: within3Percentage, color: '#20c997' },
            { label: '4-5 Points', count: within5Points - within3Points, percentage: within5Percentage, color: '#ffc107' },
            { label: '6-10 Points', count: within10Points - within5Points, percentage: ((within10Points - within5Points) / totalPredictions * 100).toFixed(1), color: '#fd7e14' },
            { label: '11-15 Points', count: within15Points - within10Points, percentage: ((within15Points - within10Points) / totalPredictions * 100).toFixed(1), color: '#dc3545' },
            { label: '15+ Points', count: outside15Points, percentage: (outside15Points / totalPredictions * 100).toFixed(1), color: '#6c757d' }
        ];
        
        distributionData.forEach(item => {
            if (item.count > 0) {
                const barDiv = document.createElement('div');
                barDiv.style.cssText = `
                    background: ${item.color};
                    color: white;
                    padding: 10px;
                    border-radius: 4px;
                    text-align: center;
                    font-weight: bold;
                `;
                barDiv.innerHTML = `
                    <div style="font-size: 18px;">${item.percentage}%</div>
                    <div style="font-size: 12px;">${item.label}</div>
                    <div style="font-size: 10px;">(${item.count} matches)</div>
                `;
                distributionDiv.appendChild(barDiv);
            }
        });
        
        console.log(`Accuracy calculation complete: ${correctPredictions}/${totalPredictions} correct predictions (${accuracyPercentage}%)`);
        
    } catch (error) {
        console.error('Error calculating accuracy metrics:', error);
    }
}

function calculateBiggestUpsets() {
    try {
        // Query to get matches with historical ratings at the time of the match
        const query = `
            WITH MatchRatings AS (
                SELECT 
                    m.id,
                    m.season,
                    m.player_1_id,
                    m.player_2_id,
                    CAST(m.player_1_score AS INTEGER) as player_1_score,
                    CAST(m.player_2_score AS INTEGER) as player_2_score,
                    p1.first_name || ' ' || p1.last_name as player1_name,
                    p2.first_name || ' ' || p2.last_name as player2_name,
                    h1.rating as player1_rating,
                    h2.rating as player2_rating
                FROM match m
                JOIN player p1 ON m.player_1_id = p1.id
                JOIN player p2 ON m.player_2_id = p2.id
                JOIN player_rating_history h1 ON m.player_1_id = h1.player_id AND m.season = h1.season
                JOIN player_rating_history h2 ON m.player_2_id = h2.player_id AND m.season = h2.season
                WHERE m.player_1_score IS NOT NULL 
                AND m.player_2_score IS NOT NULL
                AND m.player_1_score != ''
                AND m.player_2_score != ''
                AND CAST(m.player_1_score AS INTEGER) > 0
                AND CAST(m.player_2_score AS INTEGER) > 0
                AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
            )
            SELECT 
                *,
                CASE 
                    WHEN player_1_score > player_2_score THEN 
                        CASE WHEN player1_rating < player2_rating 
                            THEN player2_rating - player1_rating 
                            ELSE 0 
                        END
                    ELSE 
                        CASE WHEN player2_rating < player1_rating 
                            THEN player1_rating - player2_rating 
                            ELSE 0 
                        END
                END as rating_upset
            FROM MatchRatings
            WHERE rating_upset > 0
            ORDER BY rating_upset DESC
            LIMIT 10
        `;
        
        const result = db.exec(query);
        
        if (result.length === 0 || result[0].values.length === 0) {
            document.getElementById('biggestUpsetsTable').innerHTML = 
                '<tr><td colspan="5" style="text-align: center; padding: 20px;">No upsets found</td></tr>';
            return;
        }
        
        let html = '';
        result[0].values.forEach(match => {
            const [id, season, p1_id, p2_id, score1, score2, name1, name2, rating1, rating2, upset_value] = match;
            
            // Additional validation
            if (score1 <= 0 || score2 <= 0 || score1 === score2) {
                return;
            }
            
            const isPlayer1Winner = score1 > score2;
            const winner = isPlayer1Winner ? name1 : name2;
            const loser = isPlayer1Winner ? name2 : name1;
            const winnerScore = isPlayer1Winner ? score1 : score2;
            const loserScore = isPlayer1Winner ? score2 : score1;
            const winnerRating = isPlayer1Winner ? rating1 : rating2;
            const loserRating = isPlayer1Winner ? rating2 : rating1;
            
            html += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; text-align: left;">
                        <span style="color: #28a745; font-weight: bold;">${winner}</span>
                        <span style="color: #6c757d; font-size: 0.9em; margin-left: 8px;">(${Math.round(winnerRating)})</span>
                    </td>
                    <td style="padding: 10px; text-align: center;">${winnerScore}-${loserScore}</td>
                    <td style="padding: 10px; text-align: right;">
                        <span style="color: #dc3545;">${loser}</span>
                        <span style="color: #6c757d; font-size: 0.9em; margin-left: 8px;">(${Math.round(loserRating)})</span>
                    </td>
                    <td style="padding: 10px; text-align: center;">Season ${season}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold;">${Math.round(upset_value)}</td>
                </tr>
            `;
        });
        
        document.getElementById('biggestUpsetsTable').innerHTML = html || 
            '<tr><td colspan="5" style="text-align: center; padding: 20px;">No valid upsets found</td></tr>';
        
    } catch (error) {
        console.error('Error calculating biggest upsets:', error);
        document.getElementById('biggestUpsetsTable').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error calculating upsets</td></tr>';
    }
}

function calculateBiggestMisses() {
    try {
        // Query to get matches with current ratings (since we're comparing to current algorithm predictions)
        const query = `
            SELECT 
                m.id,
                m.season,
                CAST(m.player_1_score AS INTEGER) as player_1_score,
                CAST(m.player_2_score AS INTEGER) as player_2_score,
                p1.first_name || ' ' || p1.last_name as player1_name,
                p2.first_name || ' ' || p2.last_name as player2_name,
                pr1.rating as player1_rating,
                pr2.rating as player2_rating
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            JOIN player_ratings pr1 ON p1.first_name || ' ' || p1.last_name = pr1.name
            JOIN player_ratings pr2 ON p2.first_name || ' ' || p2.last_name = pr2.name
            WHERE m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            AND CAST(m.player_1_score AS INTEGER) > 0
            AND CAST(m.player_2_score AS INTEGER) > 0
            AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
        `;
        
        const result = db.exec(query);
        
        if (result.length === 0 || result[0].values.length === 0) {
            document.getElementById('biggestMissesTable').innerHTML = 
                '<tr><td colspan="5" style="text-align: center; padding: 20px;">No matches found</td></tr>';
            return;
        }
        
        // Calculate prediction misses
        const misses = result[0].values.map(match => {
            const [id, season, score1, score2, name1, name2, rating1, rating2] = match;
            
            // Additional validation
            if (score1 <= 0 || score2 <= 0 || score1 === score2) {
                return null;
            }
            
            // Calculate predicted scores using the same algorithm
            const expectedRating1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
            const expectedRating2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
            
            let predictedScore1, predictedScore2;
            if (expectedRating1 > expectedRating2) {
                predictedScore1 = 21;
                predictedScore2 = Math.round(21 * (expectedRating2 / expectedRating1));
            } else {
                predictedScore2 = 21;
                predictedScore1 = Math.round(21 * (expectedRating1 / expectedRating2));
            }
            
            // Calculate the miss (difference between predicted and actual score differences)
            const actualDiff = Math.abs(score1 - score2);
            const predictedDiff = Math.abs(predictedScore1 - predictedScore2);
            const missDiff = Math.abs(actualDiff - predictedDiff);
            
            return {
                name1, name2,
                season,
                score1, score2,
                predictedScore1, predictedScore2,
                missDiff
            };
        }).filter(miss => miss !== null);
        
        // Sort by biggest misses and take top 10
        misses.sort((a, b) => b.missDiff - a.missDiff);
        const top10Misses = misses.slice(0, 10);
        
        let html = '';
        top10Misses.forEach(match => {
            html += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; text-align: left;">${match.name1} vs ${match.name2}</td>
                    <td style="padding: 10px; text-align: center;">Season ${match.season}</td>
                    <td style="padding: 10px; text-align: center;">${match.score1}-${match.score2}</td>
                    <td style="padding: 10px; text-align: center;">${match.predictedScore1}-${match.predictedScore2}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold; color: ${match.missDiff > 10 ? '#dc3545' : '#000'}">${match.missDiff}</td>
                </tr>
            `;
        });
        
        document.getElementById('biggestMissesTable').innerHTML = html || 
            '<tr><td colspan="5" style="text-align: center; padding: 20px;">No valid matches found</td></tr>';
        
    } catch (error) {
        console.error('Error calculating biggest misses:', error);
        document.getElementById('biggestMissesTable').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error calculating prediction misses</td></tr>';
    }
}

function calculatePerfectPredictions() {
    try {
        // Query to get matches with current ratings
        const query = `
            SELECT 
                m.id,
                m.season,
                CAST(m.player_1_score AS INTEGER) as player_1_score,
                CAST(m.player_2_score AS INTEGER) as player_2_score,
                p1.first_name || ' ' || p1.last_name as player1_name,
                p2.first_name || ' ' || p2.last_name as player2_name,
                pr1.rating as player1_rating,
                pr2.rating as player2_rating
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            JOIN player_ratings pr1 ON p1.first_name || ' ' || p1.last_name = pr1.name
            JOIN player_ratings pr2 ON p2.first_name || ' ' || p2.last_name = pr2.name
            WHERE m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            AND CAST(m.player_1_score AS INTEGER) > 0
            AND CAST(m.player_2_score AS INTEGER) > 0
            AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
        `;
        
        const result = db.exec(query);
        
        if (result.length === 0 || result[0].values.length === 0) {
            document.getElementById('perfectPredictionsTable').innerHTML = 
                '<tr><td colspan="4" style="text-align: center; padding: 20px;">No matches found</td></tr>';
            return;
        }
        
        // Calculate perfect predictions
        const perfectMatches = result[0].values.map(match => {
            const [id, season, score1, score2, name1, name2, rating1, rating2] = match;
            
            // Additional validation
            if (score1 <= 0 || score2 <= 0 || score1 === score2) {
                return null;
            }
            
            // Calculate predicted scores using the same algorithm
            const expectedRating1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
            const expectedRating2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
            
            let predictedScore1, predictedScore2;
            if (expectedRating1 > expectedRating2) {
                predictedScore1 = 21;
                predictedScore2 = Math.round(21 * (expectedRating2 / expectedRating1));
            } else {
                predictedScore2 = 21;
                predictedScore1 = Math.round(21 * (expectedRating1 / expectedRating2));
            }
            
            // Check if prediction is perfect (both scores match exactly)
            if (predictedScore1 === score1 && predictedScore2 === score2) {
                return {
                    name1, name2,
                    season,
                    score1, score2,
                    predictedScore1, predictedScore2
                };
            }
            
            return null;
        }).filter(match => match !== null);
        
        // Sort by season and then by match ID
        perfectMatches.sort((a, b) => {
            if (a.season !== b.season) {
                return a.season - b.season;
            }
            return 0;
        });
        
        let html = '';
        perfectMatches.forEach(match => {
            html += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; text-align: left;">${match.name1} vs ${match.name2}</td>
                    <td style="padding: 10px; text-align: center;">Season ${match.season}</td>
                    <td style="padding: 10px; text-align: center;">${match.score1}-${match.score2}</td>
                    <td style="padding: 10px; text-align: center; color: #28a745; font-weight: bold;">${match.predictedScore1}-${match.predictedScore2}</td>
                </tr>
            `;
        });
        
        document.getElementById('perfectPredictionsTable').innerHTML = html || 
            '<tr><td colspan="4" style="text-align: center; padding: 20px;">No perfect predictions found</td></tr>';
        
    } catch (error) {
        console.error('Error calculating perfect predictions:', error);
        document.getElementById('perfectPredictionsTable').innerHTML = 
            '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Error calculating perfect predictions</td></tr>';
    }
}
