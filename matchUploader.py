import csv
import sqlite3

con = sqlite3.connect("./storage.db")
cursor = con.cursor()

with open('matchesToUpload.csv') as newMatches:
    csvreader = csv.reader(newMatches, delimiter=',')
    for row in csvreader:
        player1Name = row[0].split(" ")
        player2Name = row[1].split(" ")
        for playerName in [player1Name, player2Name]:
            exists = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [playerName[0], playerName[1]])
            if (exists.fetchone() is None):
                print("adding new player")
                cursor.execute("INSERT INTO player (first_name, last_name) VALUES (?,?)", [playerName[0], playerName[1]])
                con.commit()

        player1 = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [player1Name[0], player1Name[1]]).fetchone()
        player2 = cursor.execute("SELECT * FROM player WHERE first_name=? AND last_name=?", [player2Name[0], player2Name[1]]).fetchone()

        cursor.execute("INSERT INTO match (player_1_id, player_2_id, player_1_score, player_2_score, season, playoff) VALUES (?,?,?,?,?,?)", [player1[0], player2[0], row[2], row[3], row[4], row[5]])
        con.commit()
