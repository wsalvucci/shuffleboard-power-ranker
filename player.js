// Global database variable
let db;
let playerRatingChart = null;
let currentPlayerId = null;
let currentPlayerName = null;

// Initialize the database connection when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Player page loaded, initializing database connection...');
    
    // Get player ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    let idParam = urlParams.get('id');
    
    if (!idParam) {
        // Try to get from URL path (for routing like player/123)
        const pathParts = window.location.pathname.split('/');
        const playerIdFromPath = pathParts[pathParts.length - 1];
        if (playerIdFromPath && !isNaN(playerIdFromPath)) {
            idParam = playerIdFromPath;
        }
    }
    
    // Parse as integer and validate
    currentPlayerId = parseInt(idParam, 10);
    if (isNaN(currentPlayerId) || currentPlayerId <= 0) {
        showError('Invalid or missing player ID');
        return;
    }
    
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
        const response = await fetch('storage.db?v=' + Date.now());
        const arrayBuffer = await response.arrayBuffer();
        
        // Create database instance
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        
        console.log('Database loaded successfully');
        
        // Load player data
        loadPlayerData();
        
    } catch (error) {
        console.error('Error loading database:', error);
        showError('Error loading database');
    }
}

function loadPlayerData() {
    try {
        // Get player information
        const playerQuery = `
            SELECT 
                pr.name,
                pr.rating,
                pr.wins,
                pr.losses,
                pr.points_for,
                pr.points_against,
                pr.matches,
                CASE 
                    WHEN (pr.wins + pr.losses) > 0 
                    THEN (pr.wins * 100.0) / (pr.wins + pr.losses)
                    ELSE 0 
                END as win_percentage
            FROM player_ratings pr
            WHERE pr.player_id = ${currentPlayerId}
        `;
        
        const playerResult = db.exec(playerQuery);
        
        if (playerResult.length === 0 || playerResult[0].values.length === 0) {
            showError('Player not found');
            return;
        }
        
        const playerData = playerResult[0].values[0];
        const [name, rating, wins, losses, pointsFor, pointsAgainst, matches, winPercentage] = playerData;
        
        currentPlayerName = name;
        
        // Update page title
        document.title = `${name} - Shuffleboard Power Rankings`;
        
        // Update player header
        document.getElementById('playerName').textContent = name;
        document.getElementById('currentRating').textContent = Math.round(rating);
        document.getElementById('overallRecord').textContent = `${wins}-${losses}`;
        document.getElementById('winPercentage').textContent = `${Math.round(winPercentage)}%`;
        document.getElementById('totalMatches').textContent = matches;
        
        // Load all player data
        loadPlayerRatingChart();
        loadCurrentForm();
        loadSeasonalStats();
        loadHeadToHeadRecords();
        loadPersonalUpsets();
        loadPredictionAccuracy();
        
    } catch (error) {
        console.error('Error loading player data:', error);
        showError('Error loading player data');
    }
}

function loadPlayerRatingChart() {
    try {
        // Get player's rating history
        const chartQuery = `
            SELECT season, rating 
            FROM player_rating_history 
            WHERE player_id = ${currentPlayerId} AND matches > 0
            ORDER BY season ASC
        `;
        
        const chartResult = db.exec(chartQuery);
        
        if (chartResult.length === 0 || chartResult[0].values.length === 0) {
            console.log('No rating history available for player');
            return;
        }
        
        // Process the data for Chart.js
        const seasons = [];
        const ratings = [];
        
        chartResult[0].values.forEach(row => {
            const [season, rating] = row;
            seasons.push(`Season ${season}`);
            ratings.push(Math.round(rating));
        });
        
        // Create the chart
        const ctx = document.getElementById('playerRatingChart').getContext('2d');
        
        if (playerRatingChart) {
            playerRatingChart.destroy();
        }
        
        playerRatingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: seasons,
                datasets: [{
                    label: `${currentPlayerName}'s Rating`,
                    data: ratings,
                    borderColor: '#00d4ff',
                    backgroundColor: '#00d4ff20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: '#00ffff',
                    pointBorderColor: '#00d4ff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${currentPlayerName}'s Rating Progression`,
                        color: '#e0e0e0',
                        font: {
                            family: 'Orbitron',
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'nearest',
                        intersect: true,
                        backgroundColor: '#1a1a2e',
                        titleColor: '#00ffff',
                        bodyColor: '#e0e0e0',
                        borderColor: '#00d4ff',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Rating',
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: 'rgba(0, 212, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Season',
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: 'rgba(0, 212, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
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
        console.error('Error creating player rating chart:', error);
    }
}

function loadCurrentForm() {
    try {
        // Get player's last 5 matches
        const formQuery = `
            SELECT 
                m.season,
                m.player_1_score,
                m.player_2_score,
                p1.first_name || ' ' || p1.last_name as player1_name,
                p2.first_name || ' ' || p2.last_name as player2_name,
                CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN 'player1'
                    ELSE 'player2'
                END as player_position
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE (m.player_1_id = ${currentPlayerId} OR m.player_2_id = ${currentPlayerId})
            AND m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            AND CAST(m.player_1_score AS INTEGER) > 0
            AND CAST(m.player_2_score AS INTEGER) > 0
            AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
            ORDER BY m.id DESC
            LIMIT 5
        `;
        
        const formResult = db.exec(formQuery);
        
        if (formResult.length === 0 || formResult[0].values.length === 0) {
            document.getElementById('formMatches').innerHTML = '<div style="text-align: center; padding: 20px;">No recent matches found.</div>';
            return;
        }
        
        let html = '<div class="form-matches-grid">';
        
        formResult[0].values.forEach(match => {
            const [season, score1, score2, player1Name, player2Name, playerPosition] = match;
            
            // Additional validation to ensure scores are valid integers
            const player1Score = parseInt(score1);
            const player2Score = parseInt(score2);
            
            if (isNaN(player1Score) || isNaN(player2Score) || player1Score <= 0 || player2Score <= 0 || player1Score === player2Score) {
                return; // Skip invalid matches
            }
            
            const isPlayer1 = playerPosition === 'player1';
            const playerScore = isPlayer1 ? player1Score : player2Score;
            const opponentScore = isPlayer1 ? player2Score : player1Score;
            const opponentName = isPlayer1 ? player2Name : player1Name;
            const result = playerScore > opponentScore ? 'W' : 'L';
            const resultClass = result === 'W' ? 'win' : 'loss';
            
            html += `
                <div class="form-match ${resultClass}">
                    <div class="match-result">${result}</div>
                    <div class="match-details">
                        <div class="match-score">${playerScore}-${opponentScore}</div>
                        <div class="match-opponent">vs ${opponentName}</div>
                        <div class="match-season">Season ${season}</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        document.getElementById('formMatches').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading current form:', error);
        document.getElementById('formMatches').innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Error loading recent matches</div>';
    }
}

function loadSeasonalStats() {
    try {
        // Get player's seasonal stats
        const seasonalQuery = `
            SELECT 
                season,
                rating,
                wins,
                losses,
                points_for,
                points_against,
                matches,
                CASE 
                    WHEN (wins + losses) > 0 
                    THEN (wins * 100.0) / (wins + losses)
                    ELSE 0 
                END as win_percentage
            FROM player_rating_history 
            WHERE player_id = ${currentPlayerId} AND matches > 0
            ORDER BY season ASC
        `;
        
        const seasonalResult = db.exec(seasonalQuery);
        
        if (seasonalResult.length === 0 || seasonalResult[0].values.length === 0) {
            document.getElementById('seasonalStatsTable').innerHTML = '<tr><td colspan="8" style="text-align: center;">No seasonal data found.</td></tr>';
            return;
        }
        
        let html = '';
        
        seasonalResult[0].values.forEach(row => {
            const [season, rating, wins, losses, pointsFor, pointsAgainst, matches, winPercentage] = row;
            
            html += `
                <tr>
                    <td>Season ${season}</td>
                    <td>${Math.round(rating)}</td>
                    <td>${wins}</td>
                    <td>${losses}</td>
                    <td>${Math.round(winPercentage)}%</td>
                    <td>${pointsFor}</td>
                    <td>${pointsAgainst}</td>
                    <td>${matches}</td>
                </tr>
            `;
        });
        
        document.getElementById('seasonalStatsTable').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading seasonal stats:', error);
        document.getElementById('seasonalStatsTable').innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Error loading seasonal stats</td></tr>';
    }
}

function loadHeadToHeadRecords() {
    try {
        // Get all opponents
        const opponentsQuery = `
            SELECT DISTINCT 
                CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN p2.first_name || ' ' || p2.last_name
                    ELSE p1.first_name || ' ' || p1.last_name
                END as opponent_name
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE (m.player_1_id = ${currentPlayerId} OR m.player_2_id = ${currentPlayerId})
            AND m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            AND CAST(m.player_1_score AS INTEGER) > 0
            AND CAST(m.player_2_score AS INTEGER) > 0
            AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
            ORDER BY opponent_name
        `;
        
        const opponentsResult = db.exec(opponentsQuery);
        
        // Populate opponent dropdown
        const opponentSelect = document.getElementById('opponentSelect');
        opponentSelect.innerHTML = '<option value="">All Opponents</option>';
        
        if (opponentsResult.length > 0 && opponentsResult[0].values.length > 0) {
            opponentsResult[0].values.forEach(row => {
                const [opponentName] = row;
                const option = document.createElement('option');
                option.value = opponentName;
                option.textContent = opponentName;
                opponentSelect.appendChild(option);
            });
        }
        
        // Load head-to-head data
        loadH2HData();
        
        // Add event listener for opponent filter
        opponentSelect.addEventListener('change', loadH2HData);
        
    } catch (error) {
        console.error('Error loading head-to-head records:', error);
        document.getElementById('h2hTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading head-to-head records</td></tr>';
    }
}

function loadH2HData() {
    try {
        const selectedOpponent = document.getElementById('opponentSelect').value;
        
        // Get head-to-head data
        let h2hQuery = `
            SELECT 
                CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN p2.first_name || ' ' || p2.last_name
                    ELSE p1.first_name || ' ' || p1.last_name
                END as opponent_name,
                COUNT(*) as total_matches,
                SUM(CASE 
                    WHEN (m.player_1_id = ${currentPlayerId} AND m.player_1_score > m.player_2_score) OR
                         (m.player_2_id = ${currentPlayerId} AND m.player_2_score > m.player_1_score)
                    THEN 1 ELSE 0 END) as wins,
                AVG(CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN m.player_1_score
                    ELSE m.player_2_score
                END) as avg_score_for,
                AVG(CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN m.player_2_score
                    ELSE m.player_1_score
                END) as avg_score_against,
                MAX(m.season) as last_season
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE (m.player_1_id = ${currentPlayerId} OR m.player_2_id = ${currentPlayerId})
            AND m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            AND CAST(m.player_1_score AS INTEGER) > 0
            AND CAST(m.player_2_score AS INTEGER) > 0
            AND CAST(m.player_1_score AS INTEGER) != CAST(m.player_2_score AS INTEGER)
        `;
        
        if (selectedOpponent) {
            h2hQuery += ` AND (
                CASE 
                    WHEN m.player_1_id = ${currentPlayerId} THEN p2.first_name || ' ' || p2.last_name
                    ELSE p1.first_name || ' ' || p1.last_name
                END = '${selectedOpponent.replace(/'/g, "''")}'
            )`;
        }
        
        h2hQuery += `
            GROUP BY opponent_name
            ORDER BY total_matches DESC, wins DESC
        `;
        
        const h2hResult = db.exec(h2hQuery);
        
        if (h2hResult.length === 0 || h2hResult[0].values.length === 0) {
            document.getElementById('h2hTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center;">No head-to-head data found.</td></tr>';
            return;
        }
        
        let html = '';
        
        h2hResult[0].values.forEach(row => {
            const [opponentName, totalMatches, wins, avgScoreFor, avgScoreAgainst, lastSeason] = row;
            const losses = totalMatches - wins;
            const winPercentage = totalMatches > 0 ? (wins / totalMatches * 100) : 0;
            
            html += `
                <tr>
                    <td>${opponentName}</td>
                    <td>${wins}-${losses}</td>
                    <td>${Math.round(winPercentage)}%</td>
                    <td>${Math.round(avgScoreFor)}</td>
                    <td>${Math.round(avgScoreAgainst)}</td>
                    <td>Season ${lastSeason}</td>
                </tr>
            `;
        });
        
        document.getElementById('h2hTableBody').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading H2H data:', error);
        document.getElementById('h2hTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading head-to-head data</td></tr>';
    }
}

function loadPersonalUpsets() {
    try {
        // Get player's biggest upsets (when they won against higher-rated opponents)
        const upsetsQuery = `
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
                WHERE (m.player_1_id = ${currentPlayerId} OR m.player_2_id = ${currentPlayerId})
                AND m.player_1_score IS NOT NULL 
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
                    WHEN player_1_id = ${currentPlayerId} THEN 
                        CASE 
                            WHEN player_1_score > player_2_score AND player1_rating < player2_rating
                            THEN player2_rating - player1_rating
                            ELSE 0
                        END
                    ELSE 
                        CASE 
                            WHEN player_2_score > player_1_score AND player2_rating < player1_rating
                            THEN player1_rating - player2_rating
                            ELSE 0
                        END
                END as upset_value
            FROM MatchRatings
            WHERE upset_value > 0
            ORDER BY upset_value DESC
            LIMIT 10
        `;
        
        const upsetsResult = db.exec(upsetsQuery);
        
        if (upsetsResult.length === 0 || upsetsResult[0].values.length === 0) {
            document.getElementById('personalUpsetsTable').innerHTML = '<tr><td colspan="6" style="text-align: center;">No upsets found.</td></tr>';
            return;
        }
        
        let html = '';
        
        upsetsResult[0].values.forEach(match => {
            const [id, season, p1_id, p2_id, score1, score2, name1, name2, rating1, rating2, upset_value] = match;
            
            const isPlayer1 = p1_id === parseInt(currentPlayerId);
            const playerName = isPlayer1 ? name1 : name2;
            const opponentName = isPlayer1 ? name2 : name1;
            const playerRating = isPlayer1 ? rating1 : rating2;
            const opponentRating = isPlayer1 ? rating2 : rating1;
            const playerScore = isPlayer1 ? score1 : score2;
            const opponentScore = isPlayer1 ? score2 : score1;
            
            html += `
                <tr>
                    <td>${playerName} vs ${opponentName} (${playerScore}-${opponentScore})</td>
                    <td>Season ${season}</td>
                    <td>${Math.round(playerRating)}</td>
                    <td>${Math.round(opponentRating)}</td>
                    <td>${Math.round(upset_value)}</td>
                    <td style="color: #28a745; font-weight: bold;">WIN</td>
                </tr>
            `;
        });
        
        document.getElementById('personalUpsetsTable').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading personal upsets:', error);
        document.getElementById('personalUpsetsTable').innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading upsets</td></tr>';
    }
}

function loadPredictionAccuracy() {
    try {
        // Get all matches for this player
        const matchesQuery = `
            SELECT 
                m.player_1_score, m.player_2_score,
                p1.first_name || ' ' || p1.last_name as player1_name,
                p2.first_name || ' ' || p2.last_name as player2_name,
                pr1.rating as player1_rating,
                pr2.rating as player2_rating
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            JOIN player_ratings pr1 ON p1.first_name || ' ' || p1.last_name = pr1.name
            JOIN player_ratings pr2 ON p2.first_name || ' ' || p2.last_name = pr2.name
            WHERE (m.player_1_id = ${currentPlayerId} OR m.player_2_id = ${currentPlayerId})
            AND m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            ORDER BY m.id
        `;
        
        const matchesResult = db.exec(matchesQuery);
        
        if (matchesResult.length === 0 || matchesResult[0].values.length === 0) {
            console.log('No match data available for prediction accuracy calculation');
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
        matchesResult[0].values.forEach(match => {
            const [score1, score2, player1Name, player2Name, player1Rating, player2Rating] = match;
            
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
            
            // Calculate predicted scores using the same algorithm
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
        
        // Update the UI
        document.getElementById('playerAccuracy').textContent = `${accuracyPercentage}%`;
        document.getElementById('playerExactPredictions').textContent = `${exactPercentage}%`;
        document.getElementById('playerWithin3Points').textContent = `${within3Percentage}%`;
        document.getElementById('playerWithin5Points').textContent = `${within5Percentage}%`;
        
        // Create distribution chart
        const breakdownDiv = document.getElementById('predictionBreakdown');
        breakdownDiv.innerHTML = '';
        
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
                    margin: 5px;
                `;
                barDiv.innerHTML = `
                    <div style="font-size: 18px;">${item.percentage}%</div>
                    <div style="font-size: 12px;">${item.label}</div>
                    <div style="font-size: 10px;">(${item.count} matches)</div>
                `;
                breakdownDiv.appendChild(barDiv);
            }
        });
        
        console.log(`Player accuracy calculation complete: ${correctPredictions}/${totalPredictions} correct predictions (${accuracyPercentage}%)`);
        
    } catch (error) {
        console.error('Error calculating player prediction accuracy:', error);
    }
}

function showError(message) {
    document.body.innerHTML = `
        <div class="container">
            <div style="text-align: center; padding: 50px;">
                <h1 style="color: var(--error-red);">Error</h1>
                <p style="color: var(--text-primary); font-size: 1.2rem;">${message}</p>
                <a href="index.html" style="background: var(--accent-blue); color: var(--bg-primary); padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block; margin-top: 20px;">
                    Return to Home
                </a>
            </div>
        </div>
    `;
} 