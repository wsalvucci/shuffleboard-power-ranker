# Shuffleboard Power Ranker

A web-based power ranking system for shuffleboard players that uses the Elo rating system to calculate player ratings and predict match outcomes.

## Features

### 🏆 Player Rankings
- **Current Rankings**: Real-time player ratings based on all historical matches
- **Active Players**: Rankings for players who participated in the current season
- **Seasonal History**: Track how player ratings have evolved over multiple seasons
- **Player Statistics**: Wins, losses, win percentage, points for/against

### 📊 Algorithm Performance
- **Prediction Accuracy**: Overall winner prediction accuracy (currently ~73.6%)
- **Score Prediction**: Distribution of how close the algorithm's score predictions are to actual results
- **Perfect Predictions**: List of matches where the algorithm predicted both winner and exact score correctly

### 🎯 Match Analysis
- **Biggest Upsets**: Top 10 matches where lower-rated players beat higher-rated opponents
- **Biggest Prediction Misses**: Top 10 matches where the algorithm's predictions were furthest from actual results
- **Match Predictor**: Interactive tool to predict outcomes between any two players

### 📈 Visualizations
- **Rating Progression Chart**: Interactive line chart showing how player ratings have changed over seasons
- **Performance Metrics**: Visual breakdown of prediction accuracy and score closeness

## Technology Stack

- **Backend**: Python 3 with SQLite database
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: SQLite with sql.js for client-side database access
- **Charts**: Chart.js for data visualization
- **Server**: Python's built-in HTTP server

## Installation & Setup

### Prerequisites
- Python 3.7 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shuffleboard-power-ranker
   ```

2. **Set up virtual environment** (recommended)
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the rating calculation script**
   ```bash
   python3 ShuffleboardPowerRanker.py
   ```

5. **Start the web server**
   ```bash
   ./start_server.sh
   # Or manually: python3 -m http.server 8000
   ```

6. **Open your browser**
   Navigate to `http://localhost:8000`

## Usage

### Adding New Matches

1. **Prepare your data**: Add new matches to `matchesToUpload.csv` in the format:
   ```
   player1_first_name,player1_last_name,player2_first_name,player2_last_name,player1_score,player2_score,season
   ```

2. **Upload to database**:
   ```bash
   python3 matchUploader.py
   ```

3. **Recalculate ratings**:
   ```bash
   python3 ShuffleboardPowerRanker.py
   ```

4. **Refresh the web app** to see updated rankings

### Using the Match Predictor

1. Select two players from the dropdown menus
2. Click "Predict Match"
3. View the predicted score and winner

### Viewing Player History

1. Click the "History" button next to any player in the rankings
2. View their season-by-season performance and rating progression

## Project Structure

```
shuffleboard-power-ranker/
├── index.html              # Main web application
├── script.js               # Frontend JavaScript logic
├── styles.css              # CSS styling
├── ShuffleboardPowerRanker.py  # Main rating calculation script
├── matchUploader.py        # Script to upload new matches
├── TierListMaker.py        # Tier list generation (legacy)
├── start_server.sh         # Server startup script
├── storage.db              # SQLite database
├── matchesToUpload.csv     # New match data source
├── tiers.json              # Tier list data
├── requirements.txt        # Python dependencies
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Algorithm Details

### Elo Rating System
- **Base Rating**: 1500 for new players
- **K-Factor**: 32 (rating change per match)
- **Expected Score**: Calculated using standard Elo formula
- **Score Prediction**: Winner scores 21 points, loser's score based on rating difference

### Rating Calculation
1. Calculate expected win probability for each player
2. Determine actual result (win/loss)
3. Update ratings based on performance vs. expectation
4. Track seasonal progression and overall statistics

### Prediction Algorithm
- Uses current player ratings to predict match outcomes
- Calculates expected score differences
- Rounds predictions to nearest integer
- Tracks accuracy and performance metrics

## Database Schema

### Tables
- **`player`**: Player information (id, first_name, last_name)
- **`match`**: Match results (player_1_id, player_2_id, scores, season)
- **`player_ratings`**: Current player ratings and statistics
- **`player_rating_history`**: Historical ratings by season

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to use and modify as needed.

## Support

For questions or issues, please open an issue on the repository or contact the maintainer.

---

**Note**: This system is designed for shuffleboard but can be adapted for other competitive games by modifying the scoring system and rating parameters. 