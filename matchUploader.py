import csv
import sqlite3

con = sqlite3.connect("./storage.db")
cursor = con.cursor()

# Clear existing matches
print("Clearing existing matches...")
cursor.execute("DELETE FROM match")
con.commit()
print("✓ All existing matches cleared")

# Track statistics
matches_added = 0
players_added = 0

with open('matchesToUpload.csv') as newMatches:
    csvreader = csv.reader(newMatches, delimiter=',')
    for row in csvreader:
        player1Name = row[0].split(" ")
        player2Name = row[1].split(" ")
        
        # Add players if they don't exist
        for playerName in [player1Name, player2Name]:
            exists = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [playerName[0], playerName[1]])
            if (exists.fetchone() is None):
                print(f"Adding new player: {playerName[0]} {playerName[1]}")
                cursor.execute("INSERT INTO player (first_name, last_name) VALUES (?,?)", [playerName[0], playerName[1]])
                con.commit()
                players_added += 1

        player1 = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [player1Name[0], player1Name[1]]).fetchone()
        player2 = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [player2Name[0], player2Name[1]]).fetchone()

        # Add the match
        cursor.execute("INSERT INTO match (player_1_id, player_2_id, player_1_score, player_2_score, season, playoff) VALUES (?,?,?,?,?,?)", [player1[0], player2[0], row[2], row[3], row[4], row[5]])
        con.commit()
        matches_added += 1
        print(f"Added match: {row[0]} vs {row[1]} ({row[2]}-{row[3]}) Season {row[4]}")

print(f"\nUpload Summary:")
print(f"Players added: {players_added}")
print(f"Matches added: {matches_added}")
print(f"Total matches processed: {matches_added}")
