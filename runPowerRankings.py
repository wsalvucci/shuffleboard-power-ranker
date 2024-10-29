import sqlite3

con = sqlite3.connect("./storage.db")
cursor = con.cursor()

matches = cursor.execute("SELECT * FROM match").fetchall()

players = {}

defaultStats = {
        'wins': 0,
        'losses': 0,
        'matches': 0,
        'pointsFor': 0,
        'pointsAgainst': 0,
        'rating': 0,
        'seasons': {}
        }

defaultSeasonStats = {
        'wins': 0,
        'losses': 0,
        'matches': 0,
        'pointsFor': 0,
        'pointsAgainst': 0,
        }

def sigmoid(xShift, compression):
    return 0

def expectedRating(rating, oppRating):
    return 1 / (1 + 10 ** ((oppRating - rating) / 400))

def expectedScore(expRating, oppExpRating):
    if (expRating > oppExpRating):
        return 21
    else:
        return (expRating / oppExpRating) * 21

def scoreToRating(exp1, exp2, score1, score2):
    



for match in matches:
    player1 = match[1]
    player2 = match[2]
    player1Score = match[3]
    player2Score = match[4]
    season = match[5]
    playoff = match[6]

    if player1 not in players:
     players[player1] = defaultStats
    if player2 not in players:
        players[player2] = defaultStats

    expectedRating1 = expectedRating(players[player1]['rating'], players[player2]['rating'])
    expectedRating2 = expectedRating(players[player2]['rating'], players[player1]['rating'])
    
    

    
