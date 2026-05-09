// Agricultural Market Trivia Data
export interface AgriculturalTrivia {
  id: string;
  category: 'commodity' | 'weather' | 'trading' | 'history' | 'technology' | 'equity' | 'bonds' | 'debt';
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
    id: 'turmeric-trading',
    category: 'commodity',
    title: 'Turmeric: The Golden Spice',
    content: 'India produces about 80% of the world\'s turmeric and consumes 90% of its own production. Turmeric futures on NCDEX are highly volatile due to weather dependency and strong domestic demand from both food and pharmaceutical industries.',
    relatedTerms: ['turmeric', 'spice', 'India', 'pharmaceutical'],
    funFact: 'Turmeric prices can swing 50% in a single season based on monsoon patterns!'
  },
  {
    id: 'chana-pulses',
    category: 'commodity',
    title: 'Chana: India\'s Protein Powerhouse',
    content: 'Chickpea (Chana) is India\'s largest pulse crop, accounting for about 40% of total pulse production. NCDEX chana futures are influenced by monsoon patterns, government policies, and import decisions from countries like Australia and Canada.',
    relatedTerms: ['chana', 'pulse', 'protein', 'monsoon'],
    funFact: 'India imports more chickpeas than it produces, making it the world\'s largest importer!'
  },
  {
    id: 'cardamom-queen',
    category: 'commodity',
    title: 'Cardamom: Queen of Spices',
    content: 'Cardamom is one of the world\'s most expensive spices by weight, often called the "Queen of Spices." India produces about 75% of global cardamom, primarily in Kerala and Karnataka. Weather in the Western Ghats directly impacts global prices.',
    relatedTerms: ['cardamom', 'spice', 'Kerala', 'expensive'],
    funFact: 'Cardamom can cost more than ₹2,500 per kilogram, making it worth more than silver!'
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
  },
  {
    id: 'guar-gum-fracking',
    category: 'commodity',
    title: 'Guar Gum: From Fields to Oil Wells',
    content: 'Guar gum, derived from guar beans grown mainly in Rajasthan, is essential for hydraulic fracturing (fracking) in oil extraction. About 80% of global guar production comes from India, making it a geopolitically sensitive commodity.',
    relatedTerms: ['guar', 'fracking', 'Rajasthan', 'oil'],
    funFact: 'The US shale boom made guar prices jump from ₹83,000 to ₹8,30,000 per ton!'
  },
  {
    id: 'cotton-weather',
    category: 'weather',
    title: 'Cotton and Climate Sensitivity',
    content: 'Cotton is extremely weather-sensitive, requiring specific temperature and rainfall patterns. A single hailstorm can destroy entire fields, while drought stress affects fiber quality. Global cotton prices react instantly to weather reports from major producing regions.',
    relatedTerms: ['cotton', 'weather', 'fiber', 'drought'],
    funFact: 'It takes about 2,700 liters of water to produce enough cotton for one t-shirt!'
  },
  {
    id: 'rubber-tapping',
    category: 'commodity',
    title: 'Natural Rubber: Tree to Tire',
    content: 'Natural rubber comes from latex tapped from Hevea brasiliensis trees. Thailand and Indonesia dominate global production. Rubber tapping can only be done in early morning hours, and trees must be at least 6 years old before tapping begins.',
    relatedTerms: ['rubber', 'latex', 'Thailand', 'tapping'],
    funFact: 'A single rubber tree produces only 30ml of latex per day, enough for about one surgical glove!'
  },
  {
    id: 'cocoa-child-labor',
    category: 'commodity',
    title: 'Cocoa: Sweet Commodity, Bitter Reality',
    content: 'West Africa produces 70% of the world\'s cocoa, primarily from Côte d\'Ivoire and Ghana. Cocoa farming faces challenges including aging trees, climate change, and social issues. Sustainable cocoa certification is becoming increasingly important for traders.',
    relatedTerms: ['cocoa', 'West Africa', 'sustainable', 'certification'],
    funFact: 'It takes about 400 cocoa beans to make 1 pound of chocolate!'
  },
  {
    id: 'seasonal-spreads',
    category: 'trading',
    title: 'Seasonal Trading Strategies',
    content: 'Agricultural commodities follow predictable seasonal patterns. Grain traders often use calendar spreads, buying harvest-time contracts and selling pre-harvest contracts to profit from seasonal price variations and storage economics.',
    relatedTerms: ['seasonal', 'spread', 'calendar', 'harvest'],
    funFact: 'Corn prices typically bottom out during October harvest and peak in July before new crop.'
  },
  {
    id: 'black-pepper-king',
    category: 'commodity',
    title: 'Black Pepper: King of Spices',
    content: 'Black pepper was once so valuable it was used as currency and called "black gold." Vietnam is now the largest producer, followed by India and Indonesia. Pepper prices are highly volatile due to weather dependency and quality variations.',
    relatedTerms: ['pepper', 'Vietnam', 'currency', 'volatile'],
    funFact: 'In medieval Europe, pepper was worth more than its weight in gold!'
  },
  {
    id: 'tea-auction-system',
    category: 'trading',
    title: 'Tea Auction Markets',
    content: 'Tea trading follows a unique auction system. The Colombo Tea Auction in Sri Lanka and auctions in Kolkata and Kochi set global prices. Tea quality varies dramatically based on elevation, plucking standards, and processing methods.',
    relatedTerms: ['tea', 'auction', 'Colombo', 'quality'],
    funFact: 'The highest quality tea can sell for over ₹33,000 per kilogram at auction!'
  },
  {
    id: 'onion-storage',
    category: 'commodity',
    title: 'Onion Market Volatility',
    content: 'Onions are one of the most volatile agricultural commodities due to their perishable nature and storage limitations. In India, onion prices can fluctuate by 500% within months, leading to political implications and export bans.',
    relatedTerms: ['onion', 'volatile', 'storage', 'perishable'],
    funFact: 'Onion price spikes have toppled governments in India - they call it "onion politics"!'
  },
  {
    id: 'basis-trading',
    category: 'trading',
    title: 'Basis Trading in Agriculture',
    content: 'Basis is the difference between local cash prices and futures prices. It reflects transportation costs, local supply/demand, and storage capacity. Farmers and elevators use basis trading to hedge price risks while maintaining flexibility.',
    relatedTerms: ['basis', 'cash', 'hedge', 'transportation'],
    funFact: 'Basis can turn negative during harvest gluts when local storage is full!'
  },
  {
    id: 'vanilla-madagascar',
    category: 'commodity',
    title: 'Vanilla: World\'s Second Most Expensive Spice',
    content: 'Madagascar produces 80% of global vanilla beans. Vanilla orchids must be hand-pollinated and beans hand-harvested. The curing process takes 6 months. Cyclones in Madagascar can affect global vanilla prices for years.',
    relatedTerms: ['vanilla', 'Madagascar', 'orchid', 'cyclone'],
    funFact: 'Real vanilla extract requires 13.35 oz of vanilla beans per gallon of extract!'
  },
  {
    id: 'jute-golden-fiber',
    category: 'commodity',
    title: 'Jute: The Golden Fiber',
    content: 'Jute, known as the "golden fiber," is primarily grown in the Ganges Delta region of Bangladesh and India. As eco-consciousness grows, jute demand is increasing as a sustainable alternative to synthetic materials.',
    relatedTerms: ['jute', 'Bangladesh', 'sustainable', 'eco-friendly'],
    funFact: 'Jute plants can grow up to 4 meters tall in just 4-6 months!'
  },
  {
    id: 'equity-trading-basics',
    category: 'equity',
    title: 'Equity Trading Fundamentals',
    content: 'Equity trading involves buying and selling company shares on stock exchanges. In India, NSE and BSE are the primary exchanges. Trading happens in regular market hours (9:15 AM to 3:30 PM) with pre-market and after-market sessions for additional liquidity.',
    relatedTerms: ['equity', 'NSE', 'BSE', 'shares', 'trading'],
    funFact: 'NSE handles over 2 billion trades annually, making it one of the world\'s largest exchanges by volume!'
  },
  {
    id: 'pre-ipo-bonds',
    category: 'bonds',
    title: 'Pre-IPO Bonds: Early Access Investment',
    content: 'Pre-IPO bonds allow investors to gain exposure to companies before they go public. These bonds often come with conversion options to equity shares at predetermined ratios, offering potential upside if the company\'s IPO performs well.',
    relatedTerms: ['pre-IPO', 'bonds', 'conversion', 'IPO'],
    funFact: 'Pre-IPO bond investors can sometimes get equity at 20-30% discount to the IPO price!'
  },
  {
    id: 'ncd-basics',
    category: 'debt',
    title: 'Non-Convertible Debentures (NCDs)',
    content: 'NCDs are debt instruments that cannot be converted into equity shares. They offer fixed or floating interest rates and are tradeable on exchanges. NCDs are popular among retail investors seeking higher yields than bank deposits with relatively lower risk than equity.',
    relatedTerms: ['NCD', 'debentures', 'fixed income', 'yield'],
    funFact: 'NCDs can offer 2-3% higher returns than bank FDs while being tradeable on exchanges!'
  },
  {
    id: 'intraday-trading',
    category: 'equity',
    title: 'Intraday Trading Strategies',
    content: 'Intraday trading involves buying and selling stocks within the same trading day. Popular strategies include scalping, momentum trading, and gap trading. Traders use technical indicators like RSI, MACD, and moving averages to time their entries and exits.',
    relatedTerms: ['intraday', 'scalping', 'momentum', 'technical analysis'],
    funFact: 'Successful intraday traders typically have win rates of 40-50% but manage risk to stay profitable!'
  },
  {
    id: 'ipo-process',
    category: 'equity',
    title: 'IPO: Going Public Journey',
    content: 'Initial Public Offerings allow private companies to raise capital by selling shares to the public. The process involves merchant bankers, due diligence, price discovery, and regulatory approvals from SEBI. Retail investors get reservations in mainboard IPOs.',
    relatedTerms: ['IPO', 'SEBI', 'merchant banker', 'price discovery'],
    funFact: 'India saw over 200 IPOs in 2021, raising more than ₹1.18 lakh crores!'
  },
  {
    id: 'credit-rating-ncds',
    category: 'debt',
    title: 'Credit Ratings for NCDs',
    content: 'NCDs are rated by agencies like CRISIL, ICRA, and CARE based on creditworthiness. Ratings range from AAA (highest safety) to D (default). Higher-rated NCDs offer lower yields but better safety, while lower-rated ones provide higher returns with increased risk.',
    relatedTerms: ['credit rating', 'CRISIL', 'AAA', 'default risk'],
    funFact: 'A single notch downgrade from AA+ to AA can increase NCD yields by 50-100 basis points!'
  },
  {
    id: 'futures-options-equity',
    category: 'equity',
    title: 'Equity Derivatives: F&O Trading',
    content: 'Futures and Options on individual stocks and indices allow leveraged trading and hedging. F&O contracts expire monthly, and positions require margin payments. Options provide asymmetric risk-reward profiles, while futures offer direct leverage.',
    relatedTerms: ['futures', 'options', 'leverage', 'margin', 'derivatives'],
    funFact: 'F&O turnover in India is often 15-20 times higher than cash market turnover!'
  },
  {
    id: 'qualified-institutional-placement',
    category: 'equity',
    title: 'Qualified Institutional Placement (QIP)',
    content: 'QIP allows listed companies to raise funds from qualified institutional buyers without extensive documentation. QIPs are faster than rights issues and help companies raise capital for expansion, debt reduction, or working capital needs.',
    relatedTerms: ['QIP', 'institutional buyers', 'rights issue', 'capital raising'],
    funFact: 'QIPs must be priced at least 5% discount to the average market price of preceding two weeks!'
  },
  {
    id: 'convertible-bonds',
    category: 'bonds',
    title: 'Convertible Bonds: Best of Both Worlds',
    content: 'Convertible bonds can be converted into equity shares at predetermined ratios and times. They offer lower interest rates than regular bonds but provide equity upside potential. Popular among growth companies and income-seeking investors.',
    relatedTerms: ['convertible', 'conversion ratio', 'equity upside', 'hybrid'],
    funFact: 'Convertible bonds typically offer 2-3% lower yields than similar non-convertible bonds!'
  },
  {
    id: 'systematic-investment-plan',
    category: 'equity',
    title: 'SIP: Disciplined Equity Investment',
    content: 'Systematic Investment Plans allow regular investment in mutual funds or stocks, enabling rupee cost averaging. SIPs help reduce timing risk and build wealth through compounding. They\'re particularly effective for long-term equity wealth creation.',
    relatedTerms: ['SIP', 'rupee cost averaging', 'mutual funds', 'compounding'],
    funFact: 'A ₹10,000 monthly SIP for 20 years at 12% returns can create over ₹1 crore corpus!'
  },
  {
    id: 'corporate-bond-yields',
    category: 'debt',
    title: 'Corporate Bond Yield Dynamics',
    content: 'Corporate bond yields reflect credit risk, liquidity risk, and interest rate risk. Investment grade corporate bonds typically yield 100-300 basis points above government securities. Yield curves can invert during economic uncertainty.',
    relatedTerms: ['corporate bonds', 'yield spread', 'credit risk', 'basis points'],
    funFact: 'During the 2008 crisis, Indian corporate bond spreads widened to over 800 basis points!'
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