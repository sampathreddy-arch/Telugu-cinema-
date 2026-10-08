import pandas as pd
import matplotlib.pyplot as plt

# Load dataset
df = pd.read_csv('movies.csv')

# Calculate movie count per year sorted chronologically
movies_per_year = df['Year'].value_counts().sort_index()

# Plot the graph exactly as requested
plt.figure(figsize=(12, 5))
plt.plot(movies_per_year.index, movies_per_year.values, marker='o', color='b')
plt.xlabel("Year")
plt.ylabel("Number of Movies")
plt.title("Number of Telugu Movies Released by Year")
plt.grid(True, linestyle='--', alpha=0.6)

# Save plot image and display
plt.savefig("movies_by_year.png", bbox_inches='tight', dpi=300)
print("Plot successfully saved as 'movies_by_year.png'")
plt.show()
