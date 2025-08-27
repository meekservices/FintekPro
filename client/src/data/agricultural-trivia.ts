// Agricultural Market Trivia Data
export interface AgriculturalTrivia {
  id: string;
  category: 'commodity' | 'weather' | 'trading' | 'history' | 'technology';
  title: string;
  content: string;
  relatedTerms: string[];
  funFact?: string;
}

export const agriculturalTrivia: AgriculturalTrivia[] = [
  {
    id: 'wheat-futures',
    category: 'commodity',
    title: 'Wheat Futures Trading',
    content: 'Wheat futures were among the first standardized futures contracts, introduced at the Chicago Board of Trade in 1851. Today, wheat is traded globally with contracts for different varieties including Hard Red Winter, Soft Red Winter, and Hard Red Spring.',
    relatedTerms: ['wheat', 'futures', 'grain', 'CBOT'],
    funFact: 'A single wheat futures contract represents 5,000 bushels of wheat!'
  },
  {
    id: 'corn-ethanol',
    category: 'commodity',
    title: 'Corn and Ethanol Markets',
    content: 'About 40% of U.S. corn production goes to ethanol fuel production, making energy policies a major driver of corn prices. This connection means corn prices often correlate with oil prices and renewable fuel standards.',
    relatedTerms: ['corn', 'ethanol', 'biofuel', 'energy'],
    funFact: 'One bushel of corn can produce about 2.8 gallons of ethanol.'
  },
  {
    id: 'soybean-crush',
    category: 'trading',
    title: 'Soybean Crush Spread',
    content: 'The soybean crush spread is a key agricultural trading strategy that involves the relationship between soybeans and their processed products: soybean meal and soybean oil. Traders monitor this spread to capitalize on processing margins.',
    relatedTerms: ['soybean', 'crush', 'meal', 'oil', 'spread'],
    funFact: 'One bushel of soybeans typically yields 48 pounds of meal and 11 pounds of oil.'
  },
  {
    id: 'weather-derivatives',
    category: 'weather',
    title: 'Weather Impact on Agriculture',
    content: 'Weather derivatives allow farmers and agribusiness companies to hedge against weather-related risks. These financial instruments are based on weather indices like temperature, rainfall, or frost days, providing protection against crop losses.',
    relatedTerms: ['weather', 'derivatives', 'hedge', 'climate'],
    funFact: 'A single frost event can destroy millions of dollars worth of citrus crops.'
  },
  {
    id: 'commodity-cycles',
    category: 'history',
    title: 'Agricultural Commodity Cycles',
    content: 'Agricultural commodities follow super cycles that can last 15-20 years, driven by global population growth, economic development, and climate patterns. The last major bull cycle peaked in 2008 and 2011.',
    relatedTerms: ['cycle', 'supercycle', 'bull market', 'commodities'],
    funFact: 'Food prices have historically driven more social unrest than any other economic factor.'
  },
  {
    id: 'precision-agriculture',
    category: 'technology',
    title: 'Precision Agriculture Revolution',
    content: 'GPS-guided tractors, drone monitoring, and IoT sensors are revolutionizing farming. This technology allows farmers to optimize inputs like fertilizer and water on a field-by-field or even plant-by-plant basis.',
    relatedTerms: ['precision', 'GPS', 'drone', 'IoT', 'technology'],
    funFact: 'Modern combine harvesters can process data from over 100 sensors in real-time.'
  },
  {
    id: 'coffee-arabica',
    category: 'commodity',
    title: 'Coffee Market Dynamics',
    content: 'Arabica coffee, which makes up about 70% of global coffee production, is highly sensitive to weather conditions in Brazil. A single frost warning in Brazilian coffee regions can spike global coffee prices overnight.',
    relatedTerms: ['coffee', 'arabica', 'Brazil', 'frost'],
    funFact: 'Brazil produces about one-third of the world\'s coffee supply.'
  },
  {
    id: 'sugar-policy',
    category: 'trading',
    title: 'Sugar Market Complexity',
    content: 'The global sugar market is heavily influenced by government policies, subsidies, and trade agreements. There are essentially two sugar markets: the heavily regulated domestic markets and the volatile world market.',
    relatedTerms: ['sugar', 'policy', 'subsidies', 'trade'],
    funFact: 'Only about 30% of global sugar production is traded internationally.'
  },
  {
    id: 'cattle-cycle',
    category: 'commodity',
    title: 'Cattle Market Cycles',
    content: 'The cattle industry follows predictable 10-12 year cycles based on herd building and liquidation phases. These cycles are driven by feed costs, pasture conditions, and profitability of cattle operations.',
    relatedTerms: ['cattle', 'livestock', 'herd', 'cycle'],
    funFact: 'It takes about 2-3 years to raise a beef cattle from birth to market weight.'
  },
  {
    id: 'rice-monsoon',
    category: 'weather',
    title: 'Monsoon and Rice Production',
    content: 'Asian rice production is heavily dependent on monsoon patterns. The timing and intensity of monsoon rains can affect rice yields across multiple countries, impacting global food security and rice prices.',
    relatedTerms: ['rice', 'monsoon', 'Asia', 'rainfall'],
    funFact: 'Rice feeds more than half of the world\'s population daily.'
  },
  {
    id: 'palm-oil-deforestation',
    category: 'commodity',
    title: 'Palm Oil Sustainability',
    content: 'Palm oil is the world\'s most widely used vegetable oil, found in everything from food to cosmetics. Sustainable palm oil certification has become increasingly important due to deforestation concerns.',
    relatedTerms: ['palm oil', 'sustainability', 'deforestation', 'RSPO'],
    funFact: 'Palm oil is 10 times more efficient per hectare than other oil-producing crops.'
  },
  {
    id: 'contango-backwardation',
    category: 'trading',
    title: 'Agricultural Futures Curves',
    content: 'Agricultural commodities often exhibit seasonal patterns in their futures curves. Contango (higher future prices) typically occurs before harvest, while backwardation (lower future prices) often happens during storage periods.',
    relatedTerms: ['contango', 'backwardation', 'futures curve', 'seasonal'],
    funFact: 'Storage costs for grains can add 6-12 cents per bushel per month.'
  }
];

export const getTriviaByTerm = (term: string): AgriculturalTrivia[] => {
  return agriculturalTrivia.filter(trivia => 
    trivia.relatedTerms.some(relatedTerm => 
      relatedTerm.toLowerCase().includes(term.toLowerCase()) ||
      term.toLowerCase().includes(relatedTerm.toLowerCase())
    )
  );
};

export const getTriviaByCategory = (category: AgriculturalTrivia['category']): AgriculturalTrivia[] => {
  return agriculturalTrivia.filter(trivia => trivia.category === category);
};

export const getRandomTrivia = (): AgriculturalTrivia => {
  return agriculturalTrivia[Math.floor(Math.random() * agriculturalTrivia.length)];
};