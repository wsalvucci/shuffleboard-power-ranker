import json
import sqlite3

#Dictionary holding each player's name, wins, losses, and rating
players = {}

#Dictionary holding all matches
matches = []

#Prediction accuracy [correct, incorrect]
accuracy = [0, 0]

#Prediction closeness [exact, within 3 combined, within 5 combined, within 10 combined, within 15 combined, outside 15 combined, total]
closeness = [0, 0, 0, 0, 0, 0, 0]

#Function to process each match
def processMatch(match):
    #The format of the dictionary is player1, player2, player2score, player2score
    #If player1 or player2 doesn't exist in players, add them
    if match['player1'] not in players:
        players[match['player1']] = {'wins': 0, 'losses': 0, 'matches': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'opponentRating': 0, 'opponents': [], 'sos': 0, 'rating': 1500}
    if match['player2'] not in players:
        players[match['player2']] = {'wins': 0, 'losses': 0, 'matches': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'opponentRating': 0, 'opponents': [], 'sos': 0, 'rating': 1500}
    #Calculate the expected score for each player
    expectedScore1 = 1 / (1 + 10 ** ((players[match['player2']]['rating'] - players[match['player1']]['rating']) / 400))
    expectedScore2 = 1 / (1 + 10 ** ((players[match['player1']]['rating'] - players[match['player2']]['rating']) / 400))
    #Calculate the actual score for each player
    actualScore1 = 1 if match['player1score'] > match['player2score'] else 0
    actualScore2 = 1 if match['player2score'] > match['player1score'] else 0

    predictedScore1 = predictMatch(match['player1'], match['player2'])[0]
    predictedScore2 = predictMatch(match['player1'], match['player2'])[1]

    #Calculate the new rating for each player
    players[match['player1']]['rating'] += 32 * (actualScore1 - expectedScore1)
    players[match['player2']]['rating'] += 32 * (actualScore2 - expectedScore2)

    #Update wins and losses
    if match['player1score'] > match['player2score']:
        players[match['player1']]['wins'] += 1
        players[match['player2']]['losses'] += 1
    else:
        players[match['player2']]['wins'] += 1
        players[match['player1']]['losses'] += 1

    #Update points for and against
    players[match['player1']]['pointsFor'] += match['player1score']
    players[match['player1']]['pointsAgainst'] += match['player2score']
    players[match['player2']]['pointsFor'] += match['player2score']
    players[match['player2']]['pointsAgainst'] += match['player1score']

    #Update matches played
    players[match['player1']]['matches'] += 1
    players[match['player2']]['matches'] += 1

    #Update accuracy tracking
    if (match['player1score'] > match['player2score'] and predictedScore1 > predictedScore2) or (match['player2score'] > match['player1score'] and predictedScore2 > predictedScore1):
        accuracy[0] += 1
    else:
        accuracy[1] += 1

    #Update closeness tracking
    scoreDifference = abs((match['player1score'] - match['player2score']) - (predictedScore1 - predictedScore2))
    if scoreDifference == 0:
        closeness[0] += 1
    elif scoreDifference <= 3:
        closeness[1] += 1
    elif scoreDifference <= 5:
        closeness[2] += 1
    elif scoreDifference <= 10:
        closeness[3] += 1
    elif scoreDifference <= 15:
        closeness[4] += 1
    else:
        closeness[5] += 1
    closeness[6] += 1

    matchData = {
        'player1': match['player1'],
        'player2': match['player2'],
        'player1score': match['player1score'],
        'player2score': match['player2score'],
        'predictedScore1': str(predictedScore1),
        'predictedScore2': str(predictedScore2),
        'difference1': actualScore1 - expectedScore1,
        'difference2': actualScore2 - expectedScore2,
        'upsetValue': (predictedScore1 - predictedScore2) - (match['player1score'] - match['player2score'])
    }
    matches.append(matchData)
    #If matches has over 303 items, calculate the prediction accuracy
    if len(matches) > 303:
        accuracy[0] += 1 if (actualScore1 > actualScore2 and expectedScore1 > expectedScore2) or (actualScore1 < actualScore2 and expectedScore1 < expectedScore2) else 0
        accuracy[1] += 1 if (actualScore1 > actualScore2 and expectedScore1 < expectedScore2) or (actualScore1 < actualScore2 and expectedScore1 > expectedScore2) else 0
        closeness[0] += 1 if abs(matchData['upsetValue']) == 0 else 0
        closeness[1] += 1 if abs(matchData['upsetValue']) <= 3 else 0
        closeness[2] += 1 if abs(matchData['upsetValue']) <= 5 else 0
        closeness[3] += 1 if abs(matchData['upsetValue']) <= 10 else 0
        closeness[4] += 1 if abs(matchData['upsetValue']) <= 15 else 0
        closeness[5] += 1 if abs(matchData['upsetValue']) > 15 else 0
        closeness[6] += 1
        #if (abs(matchData['upsetValue']) == 0):
            #print(matchData)
        if (abs(matchData['upsetValue']) >= 15):
            print(str(matchData['upsetValue']) + ' : ' + matchData['player1'] + ' ' + str(matchData['player1score']) + ' (' + str(matchData['predictedScore1']) + ') ' + ' (' + str(matchData['predictedScore2']) + ') ' + str(matchData['player2score']) + ' ' + matchData['player2'])
    #Update the total opponent rating for each player
    players[match['player1']]['opponentRating'] += players[match['player2']]['rating']
    players[match['player2']]['opponentRating'] += players[match['player1']]['rating']
    #Add the opponent's to a list of opponents for each player
    players[match['player1']]['opponents'].append(match['player2'])
    players[match['player2']]['opponents'].append(match['player1'])


#Function to predict the score of a match given the players' ratings
#The winner must score 21 points
def predictMatch(player1, player2):
    #Calculate the expected score for each player
    expectedScore1 = 1 / (1 + 10 ** ((players[player2]['rating'] - players[player1]['rating']) / 400))
    expectedScore2 = 1 / (1 + 10 ** ((players[player1]['rating'] - players[player2]['rating']) / 400))
    
    #Calculate the predicted score for each player
    if expectedScore1 > expectedScore2:
        predictedScore1 = 21
        predictedScore2 = 21 * (expectedScore2 / expectedScore1)
    else:
        predictedScore2 = 21
        predictedScore1 = 21 * (expectedScore1 / expectedScore2)
    
    return [round(predictedScore1, 1), round(predictedScore2, 1)]


def calculateSeasonalRatings():
    """Calculate ratings season by season and save historical data"""
    try:
        conn = sqlite3.connect('storage.db')
        cursor = conn.cursor()
        
        # Clear existing historical data
        cursor.execute('DELETE FROM player_rating_history')
        
        # Get all matches in chronological order (by id)
        cursor.execute('''
            SELECT m.id, m.player_1_id, m.player_2_id, m.player_1_score, m.player_2_score, m.season,
                   p1.first_name || ' ' || p1.last_name as player1_name,
                   p2.first_name || ' ' || p2.last_name as player2_name
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE m.player_1_score IS NOT NULL 
            AND m.player_2_score IS NOT NULL
            AND m.player_1_score != ''
            AND m.player_2_score != ''
            ORDER BY m.id
        ''')
        
        all_matches = cursor.fetchall()
        
        print(f"Calculating ratings for {len(all_matches)} matches...")
        
        # Initialize players - ratings will accumulate across all matches
        cumulative_players = {}
        
        # Track season-specific stats
        season_stats = {}
        current_season = None
        
        # Process each match in chronological order
        for match_data in all_matches:
            match_id, player1_id, player2_id, score1, score2, season, player1_name, player2_name = match_data
            
            # Skip matches with missing or invalid scores
            try:
                score1 = int(score1)
                score2 = int(score2)
            except (ValueError, TypeError):
                print(f"Skipping match with invalid scores: {score1}, {score2} ({player1_name} vs {player2_name})")
                continue
            
            # Initialize players if they don't exist (start at 1500 rating)
            if player1_name not in cumulative_players:
                cumulative_players[player1_name] = {'rating': 1500}
            if player2_name not in cumulative_players:
                cumulative_players[player2_name] = {'rating': 1500}
            
            # Initialize season stats if this is a new season
            if season != current_season:
                current_season = season
                print(f"Processing season {season}...")
            
            # Initialize season stats if they don't exist
            if player1_name not in season_stats:
                season_stats[player1_name] = {'wins': 0, 'losses': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'matches': 0}
            if player2_name not in season_stats:
                season_stats[player2_name] = {'wins': 0, 'losses': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'matches': 0}
            
            # Calculate expected scores based on current cumulative ratings
            expectedScore1 = 1 / (1 + 10 ** ((cumulative_players[player2_name]['rating'] - cumulative_players[player1_name]['rating']) / 400))
            expectedScore2 = 1 / (1 + 10 ** ((cumulative_players[player1_name]['rating'] - cumulative_players[player2_name]['rating']) / 400))
            
            # Calculate actual scores
            actualScore1 = 1 if score1 > score2 else 0
            actualScore2 = 1 if score2 > score1 else 0
            
            # Update cumulative ratings
            cumulative_players[player1_name]['rating'] += 32 * (actualScore1 - expectedScore1)
            cumulative_players[player2_name]['rating'] += 32 * (actualScore2 - expectedScore2)
            
            # Update season-specific stats
            season_stats[player1_name]['wins'] += actualScore1
            season_stats[player1_name]['losses'] += 1 - actualScore1
            season_stats[player2_name]['wins'] += actualScore2
            season_stats[player2_name]['losses'] += 1 - actualScore2
            
            season_stats[player1_name]['pointsFor'] += score1
            season_stats[player1_name]['pointsAgainst'] += score2
            season_stats[player2_name]['pointsFor'] += score2
            season_stats[player2_name]['pointsAgainst'] += score1
            
            season_stats[player1_name]['matches'] += 1
            season_stats[player2_name]['matches'] += 1
        
        # Get all unique seasons to save historical data
        cursor.execute('SELECT DISTINCT season FROM match ORDER BY season')
        seasons = [row[0] for row in cursor.fetchall()]
        
        # For each season, save the cumulative rating at that point
        # We need to recalculate to get the rating at the end of each season
        cumulative_players_seasonal = {}
        
        for season in seasons:
            # Get matches up to and including this season
            cursor.execute('''
                SELECT m.id, m.player_1_id, m.player_2_id, m.player_1_score, m.player_2_score,
                       p1.first_name || ' ' || p1.last_name as player1_name,
                       p2.first_name || ' ' || p2.last_name as player2_name
                FROM match m
                JOIN player p1 ON m.player_1_id = p1.id
                JOIN player p2 ON m.player_2_id = p2.id
                WHERE m.player_1_score IS NOT NULL 
                AND m.player_2_score IS NOT NULL
                AND m.player_1_score != ''
                AND m.player_2_score != ''
                AND m.season <= ?
                ORDER BY m.id
            ''', (season,))
            
            season_matches = cursor.fetchall()
            
            # Reset cumulative players for this season calculation
            cumulative_players_seasonal = {}
            
            # Process each match up to this season
            for match_data in season_matches:
                match_id, player1_id, player2_id, score1, score2, player1_name, player2_name = match_data
                
                # Skip matches with missing or invalid scores
                try:
                    score1 = int(score1)
                    score2 = int(score2)
                except (ValueError, TypeError):
                    continue
                
                # Initialize players if they don't exist (start at 1500 rating)
                if player1_name not in cumulative_players_seasonal:
                    cumulative_players_seasonal[player1_name] = {'rating': 1500}
                if player2_name not in cumulative_players_seasonal:
                    cumulative_players_seasonal[player2_name] = {'rating': 1500}
                
                # Calculate expected scores based on current cumulative ratings
                expectedScore1 = 1 / (1 + 10 ** ((cumulative_players_seasonal[player2_name]['rating'] - cumulative_players_seasonal[player1_name]['rating']) / 400))
                expectedScore2 = 1 / (1 + 10 ** ((cumulative_players_seasonal[player1_name]['rating'] - cumulative_players_seasonal[player2_name]['rating']) / 400))
                
                # Calculate actual scores
                actualScore1 = 1 if score1 > score2 else 0
                actualScore2 = 1 if score2 > score1 else 0
                
                # Update cumulative ratings
                cumulative_players_seasonal[player1_name]['rating'] += 32 * (actualScore1 - expectedScore1)
                cumulative_players_seasonal[player2_name]['rating'] += 32 * (actualScore2 - expectedScore2)
            
            # Save end-of-season data to history
            for player_name, player_data in cumulative_players_seasonal.items():
                # Find or create player in player table
                name_parts = player_name.split(' ', 1)
                first_name = name_parts[0] if len(name_parts) > 0 else player_name
                last_name = name_parts[1] if len(name_parts) > 1 else ''
                
                cursor.execute('SELECT id FROM player WHERE first_name = ? AND last_name = ?', (first_name, last_name))
                result = cursor.fetchone()
                
                if result:
                    player_id = result[0]
                else:
                    cursor.execute('INSERT INTO player (first_name, last_name) VALUES (?, ?)', (first_name, last_name))
                    player_id = cursor.lastrowid
                
                # Get season-specific stats for this season only
                cursor.execute('''
                    SELECT m.player_1_id, m.player_2_id, m.player_1_score, m.player_2_score,
                           p1.first_name || ' ' || p1.last_name as player1_name,
                           p2.first_name || ' ' || p2.last_name as player2_name
                    FROM match m
                    JOIN player p1 ON m.player_1_id = p1.id
                    JOIN player p2 ON m.player_2_id = p2.id
                    WHERE m.season = ? AND m.player_1_score IS NOT NULL AND m.player_2_score IS NOT NULL
                ''', (season,))
                
                season_only_matches = cursor.fetchall()
                season_data = {'wins': 0, 'losses': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'matches': 0}
                
                for season_match in season_only_matches:
                    s_player1_id, s_player2_id, s_score1, s_score2, s_player1_name, s_player2_name = season_match
                    
                    try:
                        s_score1 = int(s_score1)
                        s_score2 = int(s_score2)
                    except (ValueError, TypeError):
                        continue
                    
                    if s_player1_name == player_name:
                        season_data['wins'] += 1 if s_score1 > s_score2 else 0
                        season_data['losses'] += 1 if s_score1 < s_score2 else 0
                        season_data['pointsFor'] += s_score1
                        season_data['pointsAgainst'] += s_score2
                        season_data['matches'] += 1
                    elif s_player2_name == player_name:
                        season_data['wins'] += 1 if s_score2 > s_score1 else 0
                        season_data['losses'] += 1 if s_score2 < s_score1 else 0
                        season_data['pointsFor'] += s_score2
                        season_data['pointsAgainst'] += s_score1
                        season_data['matches'] += 1
                
                # Insert historical rating (cumulative rating + season-specific stats)
                cursor.execute('''
                    INSERT INTO player_rating_history (player_id, name, season, rating, wins, losses, points_for, points_against, matches)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    player_id,
                    player_name,
                    season,
                    player_data['rating'],
                    season_data['wins'],
                    season_data['losses'],
                    season_data['pointsFor'],
                    season_data['pointsAgainst'],
                    season_data['matches']
                ))
        
        conn.commit()
        conn.close()
        print("Seasonal ratings saved to database successfully!")
        
    except Exception as e:
        print(f"Error calculating seasonal ratings: {e}")
        import traceback
        traceback.print_exc()


def saveRatingsToDatabase():
    """Save the calculated ratings to the storage.db database"""
    try:
        conn = sqlite3.connect('storage.db')
        cursor = conn.cursor()
        
        # Create a ratings table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS player_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER,
                name TEXT NOT NULL,
                rating REAL NOT NULL,
                wins INTEGER NOT NULL,
                losses INTEGER NOT NULL,
                points_for INTEGER NOT NULL,
                points_against INTEGER NOT NULL,
                matches INTEGER NOT NULL,
                FOREIGN KEY (player_id) REFERENCES player (id)
            )
        ''')
        
        # Clear existing ratings
        cursor.execute('DELETE FROM player_ratings')
        
        # Insert new ratings
        for player_name, player_data in players.items():
            # Split the player name into first and last name
            name_parts = player_name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else player_name
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Try to find the player in the existing player table
            cursor.execute('SELECT id FROM player WHERE first_name = ? AND last_name = ?', (first_name, last_name))
            result = cursor.fetchone()
            
            if result:
                player_id = result[0]
            else:
                # If player doesn't exist, insert them
                cursor.execute('INSERT INTO player (first_name, last_name) VALUES (?, ?)', (first_name, last_name))
                player_id = cursor.lastrowid
            
            # Insert the rating data
            cursor.execute('''
                INSERT INTO player_ratings (player_id, name, rating, wins, losses, points_for, points_against, matches)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                player_id,
                player_name,
                player_data['rating'],
                player_data['wins'],
                player_data['losses'],
                player_data['pointsFor'],
                player_data['pointsAgainst'],
                player_data['matches']
            ))
        
        conn.commit()
        conn.close()
        print("Ratings saved to database successfully!")
        
    except Exception as e:
        print(f"Error saving ratings to database: {e}")


def createMatchRatingChangesTable():
    """Create a new table to store per-match rating changes"""
    try:
        conn = sqlite3.connect('storage.db')
        cursor = conn.cursor()
        
        # Create the match_rating_changes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS match_rating_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                player_name TEXT NOT NULL,
                rating_before REAL NOT NULL,
                rating_after REAL NOT NULL,
                rating_change REAL NOT NULL,
                season INTEGER NOT NULL,
                FOREIGN KEY (match_id) REFERENCES match (id),
                FOREIGN KEY (player_id) REFERENCES player (id)
            )
        ''')
        
        # Clear existing data
        cursor.execute('DELETE FROM match_rating_changes')
        
        conn.commit()
        conn.close()
        print("Match rating changes table created successfully!")
        
    except Exception as e:
        print(f"Error creating match rating changes table: {e}")


def calculateMatchRatingChanges():
    """Calculate and store the exact rating before and after each match"""
    try:
        conn = sqlite3.connect('storage.db')
        cursor = conn.cursor()
        
        # Get all matches in chronological order (by id)
        cursor.execute('''
            SELECT m.id, m.player_1_id, m.player_2_id, m.player_1_score, m.player_2_score, m.season,
                   p1.first_name || ' ' || p1.last_name as player1_name,
                   p2.first_name || ' ' || p2.last_name as player2_name
            FROM match m
            JOIN player p1 ON m.player_1_id = p1.id
            JOIN player p2 ON m.player_2_id = p2.id
            WHERE m.player_1_score IS NOT NULL 
            AND m.player_1_score != ''
            AND m.player_2_score IS NOT NULL
            AND m.player_2_score != ''
            ORDER BY m.id
        ''')
        
        all_matches = cursor.fetchall()
        
        print(f"Calculating per-match rating changes for {len(all_matches)} matches...")
        
        # Initialize players - ratings will accumulate across all matches
        cumulative_players = {}
        
        # Process each match in chronological order
        for match_data in all_matches:
            match_id, player1_id, player2_id, score1, score2, season, player1_name, player2_name = match_data
            
            # Skip matches with missing or invalid scores
            try:
                score1 = int(score1)
                score2 = int(score2)
            except (ValueError, TypeError):
                print(f"Skipping match with invalid scores: {score1}, {score2} ({player1_name} vs {player2_name})")
                continue
            
            # Initialize players if they don't exist (start at 1500 rating)
            if player1_name not in cumulative_players:
                cumulative_players[player1_name] = {'rating': 1500}
            if player2_name not in cumulative_players:
                cumulative_players[player2_name] = {'rating': 1500}
            
            # Store ratings before the match
            player1_rating_before = cumulative_players[player1_name]['rating']
            player2_rating_before = cumulative_players[player2_name]['rating']
            
            # Calculate expected scores based on current cumulative ratings
            expectedScore1 = 1 / (1 + 10 ** ((cumulative_players[player2_name]['rating'] - cumulative_players[player1_name]['rating']) / 400))
            expectedScore2 = 1 / (1 + 10 ** ((cumulative_players[player1_name]['rating'] - cumulative_players[player2_name]['rating']) / 400))
            
            # Calculate actual scores
            actualScore1 = 1 if score1 > score2 else 0
            actualScore2 = 1 if score2 > score1 else 0
            
            # Update cumulative ratings
            cumulative_players[player1_name]['rating'] += 32 * (actualScore1 - expectedScore1)
            cumulative_players[player2_name]['rating'] += 32 * (actualScore2 - expectedScore2)
            
            # Store ratings after the match
            player1_rating_after = cumulative_players[player1_name]['rating']
            player2_rating_after = cumulative_players[player2_name]['rating']
            
            # Insert rating changes for player 1
            cursor.execute('''
                INSERT INTO match_rating_changes (match_id, player_id, player_name, rating_before, rating_after, rating_change, season)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                match_id,
                player1_id,
                player1_name,
                player1_rating_before,
                player1_rating_after,
                player1_rating_after - player1_rating_before,
                season
            ))
            
            # Insert rating changes for player 2
            cursor.execute('''
                INSERT INTO match_rating_changes (match_id, player_id, player_name, rating_before, rating_after, rating_change, season)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                match_id,
                player2_id,
                player2_name,
                player2_rating_before,
                player2_rating_after,
                player2_rating_after - player2_rating_before,
                season
            ))
        
        conn.commit()
        conn.close()
        print("Per-match rating changes calculated and stored successfully!")
        
    except Exception as e:
        print(f"Error calculating match rating changes: {e}")


# Read match data from database instead of JSON
try:
    conn = sqlite3.connect('storage.db')
    cursor = conn.cursor()
    
    # Get all matches from the database
    cursor.execute('''
        SELECT 
            m.player_1_id, m.player_2_id, m.player_1_score, m.player_2_score, m.season,
            p1.first_name || ' ' || p1.last_name as player1_name,
            p2.first_name || ' ' || p2.last_name as player2_name
        FROM match m
        JOIN player p1 ON m.player_1_id = p1.id
        JOIN player p2 ON m.player_2_id = p2.id
        WHERE m.player_1_score IS NOT NULL 
        AND m.player_2_score IS NOT NULL
        AND m.player_1_score != ''
        AND m.player_2_score != ''
        ORDER BY m.id
    ''')
    
    matches_data = cursor.fetchall()
    conn.close()
    
    # Process each match
    for match_data in matches_data:
        player1_id, player2_id, score1, score2, season, player1_name, player2_name = match_data
        
        # Skip matches with invalid scores
        try:
            score1 = int(score1)
            score2 = int(score2)
        except (ValueError, TypeError):
            print(f"Skipping match with invalid scores: {score1}, {score2} ({player1_name} vs {player2_name})")
            continue
        
        # Create match dictionary in the format expected by processMatch
        match = {
            'player1': player1_name,
            'player2': player2_name,
            'player1score': score1,
            'player2score': score2,
            'season': season
        }
        
        # Process each match
        processMatch(match)
    
    # Sort the players by rating
    sortedPlayers = sorted(players.items(), key=lambda x: x[1]['rating'], reverse=True)
    # Filter out players that have played less than 5 games
    sortedPlayers = list(filter(lambda x: x[1]['wins'] + x[1]['losses'] >= 5, sortedPlayers))
    # Calculate the average opponent rating for each player's last 5 games
    for player in sortedPlayers:
        if len(player[1]['opponents']) >= 5:
            player[1]['sos'] = sum([players[opponent]['rating'] for opponent in player[1]['opponents'][-5:]]) / 5
        else:
            player[1]['sos'] = 0
    # Print the results with the rating rounded to the nearest integer
    for player in sortedPlayers:
        print(player[0] + ": " + str(round(player[1]['rating'])))
    
    # Calculate and save seasonal ratings
    calculateSeasonalRatings()
    
    # Create and calculate match rating changes
    createMatchRatingChangesTable()
    calculateMatchRatingChanges()
    
    # Save current ratings to database
    saveRatingsToDatabase()
    
    # Export the rating results to a json file
    if accuracy[0] + accuracy[1] > 0:
        print("Accuracy: " + str(accuracy[0] / (accuracy[0] + accuracy[1])))
    if closeness[6] > 0:
        print("Closeness: " + str(closeness[0] / closeness[6]) + " " + str(closeness[1] / closeness[6]) + " " + str(closeness[2] / closeness[6]) + " " + str(closeness[3] / closeness[6]) + " " + str(closeness[4] / closeness[6]) + " " + str(closeness[5] / closeness[6]))
    with open('results.json', 'w') as outfile:
        json.dump(players, outfile)

    # For each player, predict the score of a match against each other player and write the results to predictions.json
    with open('predictions.json', 'w') as outfile:
        json.dump({player1[0]: {player2[0]: predictMatch(player1[0], player2[0]) for player2 in sortedPlayers} for player1 in sortedPlayers}, outfile)

    # Create a csv table that stores the prediction of every player against every other player
    with open('predictions.csv', 'w') as outfile:
        # Put every player name in the header
        outfile.write(',' + ','.join([player[0] for player in sortedPlayers]) + '\n')
        # Write a row for each player, where the first column is the player name and the rest of the columns are the predicted scores for the given opponent in the header
        for player1 in sortedPlayers:
            rowString = player1[0]
            for player2 in sortedPlayers:
                rowString += ',' + str(predictMatch(player1[0], player2[0])[0]) + '-' + str(predictMatch(player1[0], player2[0])[1])
            outfile.write(rowString + '\n')

except Exception as e:
    print(f"Error reading from database: {e}")
    import traceback
    traceback.print_exc()



    
