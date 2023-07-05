import pandas as pd
import json

#Pull json data from results.json and apply it to the data variable
with open('results.json') as f:
    data = json.load(f)

# Assuming `data` is your JSON object
df = pd.DataFrame.from_dict(data, orient='index')

# Calculate percentiles
percentiles = df['rating'].quantile([0.1, 0.25, 0.5, 0.75, 0.9])

# Create a function to assign tiers based on percentile
def assign_tier(rating):
    if rating >= percentiles[0.9]:
        return 'S'
    elif rating >= percentiles[0.75]:
        return 'A'
    elif rating >= percentiles[0.5]:
        return 'B'
    elif rating >= percentiles[0.25]:
        return 'C'
    elif rating >= percentiles[0.1]:
        return 'D'
    else:
        return 'F'

# Apply the function to assign tiers
df['tier'] = df['rating'].apply(assign_tier)

# Sort the dataframe by rating
df = df.sort_values(by='rating', ascending=False)

#Filter out those with less than 5 matches
df = df[df['matches'] >= 5]

# Print the dataframe to a tiers.json file
df.to_json('tiers.json', orient='index')
