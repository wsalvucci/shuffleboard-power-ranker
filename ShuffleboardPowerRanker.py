#import json file names scores.json and convert the data to a dictionary

import json

#Dictionary holding each player's name, wins, losses, and rating
players = {}

#Function to process each match
def processMatch(match):
    #The format of the dictionary is player1, player2, player2score, player2score
    #If player1 or player2 doesn't exist in players, add them
    if match['player1'] not in players:
        players[match['player1']] = {'wins': 0, 'losses': 0, 'rating': 1500}
    if match['player2'] not in players:
        players[match['player2']] = {'wins': 0, 'losses': 0, 'rating': 1500}
    #Calculate the expected score for each player
    expectedScore1 = 1 / (1 + 10 ** ((players[match['player2']]['rating'] - players[match['player1']]['rating']) / 400))
    expectedScore2 = 1 / (1 + 10 ** ((players[match['player1']]['rating'] - players[match['player2']]['rating']) / 400))
    #Calculate the actual score for each player
    actualScore1 = 1 if match['player1score'] > match['player2score'] else 0
    actualScore2 = 1 if match['player2score'] > match['player1score'] else 0
    #Calculate the new rating for each player
    players[match['player1']]['rating'] += 32 * (actualScore1 - expectedScore1)
    players[match['player2']]['rating'] += 32 * (actualScore2 - expectedScore2)
    #Update the wins and losses for each player
    players[match['player1']]['wins'] += actualScore1
    players[match['player1']]['losses'] += 1 - actualScore1
    players[match['player2']]['wins'] += actualScore2
    players[match['player2']]['losses'] += 1 - actualScore2


with open('scores.json') as json_file:
    data = json.load(json_file)
    #Each entry in the dictionary is a match
    for match in data:
        #Process each match
        processMatch(match)
        
    #Sort the players by rating
    sortedPlayers = sorted(players.items(), key=lambda x: x[1]['rating'], reverse=True)
    #Filter out players that have played less than 5 games
    sortedPlayers = list(filter(lambda x: x[1]['wins'] + x[1]['losses'] >= 5, sortedPlayers))
    #Print the results with the rating rounded to the nearest integer
    for player in sortedPlayers:
        print(player[0] + ": " + str(round(player[1]['rating'])))
    #Export the rating results to a json file
    with open('results.json', 'w') as outfile:
        json.dump(players, outfile)