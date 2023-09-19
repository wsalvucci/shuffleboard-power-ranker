import json

#Dictionary holding each player's name, wins, losses, and rating
players = {}

#Function to process each match
def processMatch(match):
    #If counted is 0, skip this match
    if match['counted'] == 0:
        return
    #The format of the dictionary is player1, player2, player2score, player2score
    #If player1 or player2 doesn't exist in players, add them
    if match['player1'] not in players:
        players[match['player1']] = {'wins': 0, 'losses': 0, 'matches': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'opponentRating': 0, 'rating': 1500}
    if match['player2'] not in players:
        players[match['player2']] = {'wins': 0, 'losses': 0, 'matches': 0, 'pointsFor': 0, 'pointsAgainst': 0, 'opponentRating': 0, 'rating': 1500}
    #Calculate the expected score for each player
    expectedScore1 = 1 / (1 + 10 ** ((players[match['player2']]['rating'] - players[match['player1']]['rating']) / 400))
    expectedScore2 = 1 / (1 + 10 ** ((players[match['player1']]['rating'] - players[match['player2']]['rating']) / 400))
    #Calculate the actual score for each player
    actualScore1 = 1 if match['player1score'] > match['player2score'] else 0
    actualScore2 = 1 if match['player2score'] > match['player1score'] else 0
    #Calculate the new rating for each player
    players[match['player1']]['rating'] += 32 * (actualScore1 - expectedScore1)
    players[match['player2']]['rating'] += 32 * (actualScore2 - expectedScore2)
    #Update the total matchces played for each player
    players[match['player1']]['matches'] += 1
    players[match['player2']]['matches'] += 1
    #Update the wins and losses for each player
    players[match['player1']]['wins'] += actualScore1
    players[match['player1']]['losses'] += 1 - actualScore1
    players[match['player2']]['wins'] += actualScore2
    players[match['player2']]['losses'] += 1 - actualScore2
    #Update each player's total points for and against
    players[match['player1']]['pointsFor'] += match['player1score']
    players[match['player1']]['pointsAgainst'] += match['player2score']
    players[match['player2']]['pointsFor'] += match['player2score']
    players[match['player2']]['pointsAgainst'] += match['player1score']
    #Update the total opponent rating for each player
    players[match['player1']]['opponentRating'] += players[match['player2']]['rating']
    players[match['player2']]['opponentRating'] += players[match['player1']]['rating']


#Function to predict the score of a match given the players' ratings
#The winner must score 21 points
def predictMatch(player1, player2):
    #Calculate the expected rating for each player
    expectedRating1 = 1 / (1 + 10 ** ((players[player2]['rating'] - players[player1]['rating']) / 400))
    expectedRating2 = 1 / (1 + 10 ** ((players[player1]['rating'] - players[player2]['rating']) / 400))
    #Calculate the expected score for each player with the higher expected rating scoring 21 points
    expectedScore1 = 21 if expectedRating1 > expectedRating2 else 21 * expectedRating1 / expectedRating2
    expectedScore2 = 21 if expectedRating2 > expectedRating1 else 21 * expectedRating2 / expectedRating1
    #Return the expected score for each player rounded to the nearest integer
    return [round(expectedScore1), round(expectedScore2)]


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

#For each player, predict the score of a match against each other player and write the results to predictions.json
with open('predictions.json', 'w') as outfile:
    json.dump({player1[0]: {player2[0]: predictMatch(player1[0], player2[0]) for player2 in sortedPlayers} for player1 in sortedPlayers}, outfile)

#Create a csv table that stores the prediction of every player against every other player
with open('predictions.csv', 'w') as outfile:
    #Put every player name in the header
    outfile.write(',' + ','.join([player[0] for player in sortedPlayers]) + '\n')
    #Write a row for each player, where the first column is the player name and the rest of the columns are the predicted scores for the given opponent in the header
    for player1 in sortedPlayers:
        rowString = player1[0]
        for player2 in sortedPlayers:
            rowString += ',' + str(predictMatch(player1[0], player2[0])[0]) + '-' + str(predictMatch(player1[0], player2[0])[1])
        outfile.write(rowString + '\n')
    


    
