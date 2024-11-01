import json

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
    #If counted is 0, skip this match
    if match['counted'] == 0:
        return
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
    #Calculate the average opponent rating for each player's last 5 games
    for player in sortedPlayers:
        player[1]['sos'] = sum([players[opponent]['rating'] for opponent in player[1]['opponents'][-5:]]) / 5
    #Print the results with the rating rounded to the nearest integer
    for player in sortedPlayers:
        print(player[0] + ": " + str(round(player[1]['rating'])))
    #Export the rating results to a json file
    print("Accuracy: " + str(accuracy[0] / (accuracy[0] + accuracy[1])))
    print("Closeness: " + str(closeness[0] / closeness[6]) + " " + str(closeness[1] / closeness[6]) + " " + str(closeness[2] / closeness[6]) + " " + str(closeness[3] / closeness[6]) + " " + str(closeness[4] / closeness[6]) + " " + str(closeness[5] / closeness[6]))
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
    


    
