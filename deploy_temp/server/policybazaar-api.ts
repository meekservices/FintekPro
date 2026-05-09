import { Request, Response } from 'express';

// Insurance Marketplace API Service - Comprehensive Multi-Vendor Platform
// Enhanced implementation supporting 15+ insurance providers across all categories
export class InsuranceMarketplaceAPI {
  
  // Insurance quotes comparison
  static async getInsuranceQuotes(req: Request, res: Response) {
    try {
      const { insuranceType, age, income, familyMembers, city, coverage } = req.body;

      if (!insuranceType || !age || !income) {
        return res.status(400).json({
          success: false,
          error: "Insurance type, age, and income are required"
        });
      }

      // Calculate base premium based on age and coverage
      const basePremium = this.calculateBasePremium(insuranceType, age, coverage);
      
      const quotes = this.generateProviderQuotes(insuranceType, basePremium, coverage);

      res.json({
        success: true,
        data: {
          quotes,
          comparisonCriteria: {
            insuranceType,
            age,
            income,
            familyMembers,
            city,
            coverage
          },
          recommendations: this.getRecommendations(quotes),
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error getting insurance quotes:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch insurance quotes"
      });
    }
  }

  // Health insurance calculator
  static async calculateHealthInsurance(req: Request, res: Response) {
    try {
      const { age, city, familyMembers, preExistingDiseases, coverage } = req.body;

      if (!age || !city) {
        return res.status(400).json({
          success: false,
          error: "Age and city are required"
        });
      }

      const baseRate = 5000; // Base premium
      let premium = baseRate;

      // Age factor
      if (age > 60) premium *= 2.5;
      else if (age > 45) premium *= 1.8;
      else if (age > 35) premium *= 1.4;
      else if (age > 25) premium *= 1.2;

      // Family size factor
      if (familyMembers) {
        premium *= (1 + (familyMembers * 0.3));
      }

      // City factor
      const cityFactors: { [key: string]: number } = {
        'mumbai': 1.3, 'delhi': 1.25, 'bangalore': 1.2, 'chennai': 1.15,
        'hyderabad': 1.1, 'pune': 1.1, 'kolkata': 1.05
      };
      premium *= cityFactors[city.toLowerCase()] || 1.0;

      // Coverage factor
      if (coverage) {
        premium *= (coverage / 500000);
      }

      // Pre-existing diseases
      if (preExistingDiseases && preExistingDiseases.length > 0) {
        premium *= (1 + (preExistingDiseases.length * 0.2));
      }

      res.json({
        success: true,
        data: {
          estimatedPremium: Math.round(premium),
          coverageAmount: coverage || 500000,
          planRecommendations: [
            {
              plan: "Basic Health",
              premium: Math.round(premium * 0.8),
              coverage: (coverage || 500000) * 0.8,
              features: ["Basic hospitalization", "Emergency care"]
            },
            {
              plan: "Comprehensive Health",
              premium: Math.round(premium),
              coverage: coverage || 500000,
              features: ["Complete hospitalization", "OPD coverage", "Maternity benefits"]
            },
            {
              plan: "Premium Health",
              premium: Math.round(premium * 1.3),
              coverage: (coverage || 500000) * 1.5,
              features: ["Top hospitals", "Unlimited restoration", "International coverage"]
            }
          ],
          factors: {
            age: `${age} years`,
            city,
            familyMembers: familyMembers || 1,
            preExistingDiseases: preExistingDiseases?.length || 0
          }
        }
      });
    } catch (error) {
      console.error("Error calculating health insurance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate health insurance"
      });
    }
  }

  // Life insurance calculator
  static async calculateLifeInsurance(req: Request, res: Response) {
    try {
      const { age, income, dependents, existingCoverage, smokingStatus } = req.body;

      if (!age || !income) {
        return res.status(400).json({
          success: false,
          error: "Age and income are required"
        });
      }

      // Calculate recommended coverage (10-15x annual income)
      const recommendedCoverage = income * 12 * 12; // 12x annual income
      const finalCoverage = recommendedCoverage - (existingCoverage || 0);

      // Calculate premium
      let premium = (finalCoverage * 0.005); // 0.5% of sum assured

      // Age factor
      if (age > 50) premium *= 2.0;
      else if (age > 40) premium *= 1.5;
      else if (age > 30) premium *= 1.2;

      // Smoking factor
      if (smokingStatus === 'smoker') {
        premium *= 1.5;
      }

      // Dependents factor
      if (dependents > 2) {
        premium *= 1.2;
      }

      res.json({
        success: true,
        data: {
          recommendedCoverage: finalCoverage,
          estimatedPremium: Math.round(premium / 12), // Monthly premium
          annualPremium: Math.round(premium),
          planOptions: [
            {
              plan: "Term Life Insurance",
              coverage: finalCoverage,
              monthlyPremium: Math.round(premium / 12),
              features: ["Pure protection", "High coverage", "Low premium"]
            },
            {
              plan: "ULIP (Unit Linked)",
              coverage: finalCoverage * 0.8,
              monthlyPremium: Math.round(premium / 12 * 1.8),
              features: ["Investment + insurance", "Market linked returns", "Flexibility"]
            },
            {
              plan: "Endowment Plan",
              coverage: finalCoverage * 0.7,
              monthlyPremium: Math.round(premium / 12 * 2.2),
              features: ["Guaranteed returns", "Maturity benefits", "Bonus allocation"]
            }
          ],
          factors: {
            age,
            monthlyIncome: income,
            dependents: dependents || 0,
            existingCoverage: existingCoverage || 0,
            smokingStatus: smokingStatus || 'non-smoker'
          }
        }
      });
    } catch (error) {
      console.error("Error calculating life insurance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate life insurance"
      });
    }
  }

  // Motor insurance calculator
  static async calculateMotorInsurance(req: Request, res: Response) {
    try {
      const { vehicleType, vehicleAge, city, idv, previousClaims, ncb } = req.body;

      if (!vehicleType || !vehicleAge || !city || !idv) {
        return res.status(400).json({
          success: false,
          error: "Vehicle type, age, city, and IDV are required"
        });
      }

      let basePremium = idv * 0.03; // 3% of IDV

      // Vehicle age factor
      if (vehicleAge > 5) basePremium *= 1.4;
      else if (vehicleAge > 3) basePremium *= 1.2;

      // City factor
      const cityFactors: { [key: string]: number } = {
        'mumbai': 1.5, 'delhi': 1.4, 'bangalore': 1.3, 'chennai': 1.2,
        'hyderabad': 1.15, 'pune': 1.1, 'kolkata': 1.1
      };
      basePremium *= cityFactors[city.toLowerCase()] || 1.0;

      // Claims history factor
      if (previousClaims > 0) {
        basePremium *= (1 + (previousClaims * 0.15));
      }

      // NCB (No Claim Bonus) discount
      const ncbDiscounts: { [key: string]: number } = {
        '0': 0, '1': 0.2, '2': 0.25, '3': 0.35, '4': 0.45, '5+': 0.50
      };
      const discount = ncbDiscounts[ncb] || 0;
      basePremium *= (1 - discount);

      res.json({
        success: true,
        data: {
          estimatedPremium: Math.round(basePremium),
          idv,
          ncbDiscount: Math.round(basePremium * discount),
          coverageOptions: [
            {
              plan: "Third Party Only",
              premium: Math.round(basePremium * 0.3),
              coverage: "Legal liability only",
              features: ["Mandatory by law", "Third party damages", "Legal cover"]
            },
            {
              plan: "Comprehensive",
              premium: Math.round(basePremium),
              coverage: "Complete protection",
              features: ["Own damage", "Third party", "Theft protection", "Natural calamities"]
            },
            {
              plan: "Super Comprehensive",
              premium: Math.round(basePremium * 1.3),
              coverage: "Premium protection",
              features: ["Zero depreciation", "Engine protection", "Return to invoice", "24x7 roadside assistance"]
            }
          ],
          factors: {
            vehicleType,
            vehicleAge: `${vehicleAge} years`,
            city,
            idv: `₹${idv.toLocaleString()}`,
            previousClaims,
            ncb: `${ncb} years`
          }
        }
      });
    } catch (error) {
      console.error("Error calculating motor insurance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate motor insurance"
      });
    }
  }

  // Travel insurance calculator
  static async calculateTravelInsurance(req: Request, res: Response) {
    try {
      const { destination, duration, age, tripType, coverage } = req.body;

      if (!destination || !duration || !age) {
        return res.status(400).json({
          success: false,
          error: "Destination, duration, and age are required"
        });
      }

      let basePremium = 500; // Base premium for domestic travel

      // Destination factor
      const destinationFactors: { [key: string]: number } = {
        'domestic': 1.0,
        'asia': 2.5,
        'europe': 4.0,
        'usa': 5.0,
        'schengen': 4.2,
        'worldwide': 4.8
      };
      basePremium *= destinationFactors[destination.toLowerCase()] || 3.0;

      // Duration factor
      basePremium *= (duration / 7); // Weekly base rate

      // Age factor
      if (age > 65) basePremium *= 2.0;
      else if (age > 55) basePremium *= 1.5;
      else if (age > 45) basePremium *= 1.2;

      // Trip type factor
      if (tripType === 'adventure') basePremium *= 1.8;
      else if (tripType === 'business') basePremium *= 1.1;

      // Coverage factor
      if (coverage) {
        basePremium *= (coverage / 100000); // Base coverage 1 lakh
      }

      res.json({
        success: true,
        data: {
          estimatedPremium: Math.round(basePremium),
          coverage: coverage || 100000,
          planOptions: [
            {
              plan: "Basic Travel",
              premium: Math.round(basePremium * 0.7),
              coverage: (coverage || 100000) * 0.5,
              features: ["Medical emergency", "Trip cancellation", "Baggage loss"]
            },
            {
              plan: "Comprehensive Travel",
              premium: Math.round(basePremium),
              coverage: coverage || 100000,
              features: ["Complete medical cover", "Trip interruption", "Personal accident", "Adventure sports"]
            },
            {
              plan: "Premium Travel",
              premium: Math.round(basePremium * 1.5),
              coverage: (coverage || 100000) * 2,
              features: ["Worldwide coverage", "Pre-existing conditions", "Evacuation cover", "Hijack cover"]
            }
          ],
          factors: {
            destination,
            duration: `${duration} days`,
            age: `${age} years`,
            tripType: tripType || 'leisure'
          }
        }
      });
    } catch (error) {
      console.error("Error calculating travel insurance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate travel insurance"
      });
    }
  }

  // Policy purchase simulation
  static async purchasePolicy(req: Request, res: Response) {
    try {
      const { insurerId, planId, customerDetails, paymentMethod } = req.body;

      if (!insurerId || !planId || !customerDetails) {
        return res.status(400).json({
          success: false,
          error: "Insurer ID, plan ID, and customer details are required"
        });
      }

      // Generate policy number
      const policyNumber = `PB${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // Simulate policy purchase
      const purchaseResponse = {
        success: true,
        data: {
          policyNumber,
          status: "Policy Purchased Successfully",
          insurerId,
          planId,
          customerName: customerDetails.name,
          premium: customerDetails.premium,
          coverage: customerDetails.coverage,
          policyStartDate: new Date().toISOString(),
          policyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
          paymentStatus: "Completed",
          transactionId: `TXN${Date.now()}`,
          certificateDownloadUrl: `/api/policybazaar/certificate/${policyNumber}`,
          nextSteps: [
            "Download your policy certificate",
            "Add nominees if not already done",
            "Keep policy documents safe",
            "Premium payment due date will be communicated"
          ]
        }
      };

      res.json(purchaseResponse);
    } catch (error) {
      console.error("Error purchasing policy:", error);
      res.status(500).json({
        success: false,
        error: "Failed to purchase policy"
      });
    }
  }

  // Policy management and tracking
  static async getPolicyStatus(req: Request, res: Response) {
    try {
      const { policyNumber, customerId } = req.body;

      if (!policyNumber) {
        return res.status(400).json({
          success: false,
          error: "Policy number is required"
        });
      }

      // Simulate policy status
      const policyStatus = {
        success: true,
        data: {
          policyNumber,
          status: "Active",
          insurerName: "HDFC Life",
          planName: "Health Insurance Premium Plan",
          premium: 15000,
          coverage: 500000,
          policyStartDate: "2024-01-15",
          policyEndDate: "2025-01-15",
          lastPremiumPaid: "2024-01-15",
          nextPremiumDue: "2025-01-15",
          claimHistory: [
            {
              claimId: "CLM001",
              claimDate: "2024-06-15",
              claimAmount: 25000,
              status: "Settled",
              hospitalName: "Apollo Hospital"
            }
          ],
          renewalDetails: {
            renewalDue: "2025-01-15",
            renewalPremium: 16200,
            discountAvailable: 500
          }
        }
      };

      res.json(policyStatus);
    } catch (error) {
      console.error("Error getting policy status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get policy status"
      });
    }
  }

  // Comprehensive Insurance Provider Database
  private static insuranceProviders = {
    health: [
      { id: "STAR_HEALTH", name: "Star Health", rating: 4.2, claimRatio: 95.8, logo: "star-health", multiplier: 0.88 },
      { id: "ICICI_LOMBARD", name: "ICICI Lombard", rating: 4.4, claimRatio: 96.8, logo: "icici-lombard", multiplier: 1.05 },
      { id: "HDFC_ERGO", name: "HDFC ERGO", rating: 4.3, claimRatio: 97.2, logo: "hdfc-ergo", multiplier: 0.92 },
      { id: "BAJAJ_ALLIANZ", name: "Bajaj Allianz General", rating: 4.1, claimRatio: 95.5, logo: "bajaj-allianz", multiplier: 0.90 },
      { id: "SBI_GENERAL", name: "SBI General", rating: 4.0, claimRatio: 94.2, logo: "sbi-general", multiplier: 0.85 },
      { id: "NEW_INDIA", name: "New India Assurance", rating: 3.9, claimRatio: 93.5, logo: "new-india", multiplier: 0.82 }
    ],
    life: [
      { id: "LIC", name: "LIC of India", rating: 4.3, claimRatio: 97.8, logo: "lic", multiplier: 0.88 },
      { id: "HDFC_LIFE", name: "HDFC Life", rating: 4.5, claimRatio: 98.2, logo: "hdfc-life", multiplier: 0.95 },
      { id: "ICICI_PRUDENTIAL", name: "ICICI Prudential", rating: 4.4, claimRatio: 97.5, logo: "icici-prudential", multiplier: 1.02 },
      { id: "SBI_LIFE", name: "SBI Life", rating: 4.2, claimRatio: 96.8, logo: "sbi-life", multiplier: 0.90 },
      { id: "BAJAJ_ALLIANZ_LIFE", name: "Bajaj Allianz Life", rating: 4.1, claimRatio: 96.2, logo: "bajaj-allianz-life", multiplier: 0.87 },
      { id: "MAX_LIFE", name: "Max Life Insurance", rating: 4.3, claimRatio: 97.1, logo: "max-life", multiplier: 0.93 }
    ],
    motor: [
      { id: "TATA_AIG", name: "Tata AIG", rating: 4.2, claimRatio: 96.5, logo: "tata-aig", multiplier: 0.95 },
      { id: "ICICI_LOMBARD", name: "ICICI Lombard", rating: 4.4, claimRatio: 96.8, logo: "icici-lombard", multiplier: 1.05 },
      { id: "HDFC_ERGO", name: "HDFC ERGO", rating: 4.3, claimRatio: 97.2, logo: "hdfc-ergo", multiplier: 0.98 },
      { id: "BAJAJ_ALLIANZ", name: "Bajaj Allianz General", rating: 4.1, claimRatio: 95.5, logo: "bajaj-allianz", multiplier: 0.92 },
      { id: "ROYAL_SUNDARAM", name: "Royal Sundaram", rating: 4.0, claimRatio: 94.8, logo: "royal-sundaram", multiplier: 0.89 },
      { id: "ORIENTAL", name: "Oriental Insurance", rating: 3.8, claimRatio: 93.2, logo: "oriental", multiplier: 0.85 }
    ],
    travel: [
      { id: "TATA_AIG", name: "Tata AIG", rating: 4.2, claimRatio: 96.5, logo: "tata-aig", multiplier: 0.95 },
      { id: "ICICI_LOMBARD", name: "ICICI Lombard", rating: 4.4, claimRatio: 96.8, logo: "icici-lombard", multiplier: 1.05 },
      { id: "HDFC_ERGO", name: "HDFC ERGO", rating: 4.3, claimRatio: 97.2, logo: "hdfc-ergo", multiplier: 0.98 },
      { id: "RELIGARE", name: "Religare Health Travel", rating: 4.1, claimRatio: 95.8, logo: "religare", multiplier: 0.90 },
      { id: "DIGIT", name: "Digit Insurance", rating: 4.0, claimRatio: 94.5, logo: "digit", multiplier: 0.88 }
    ],
    home: [
      { id: "ICICI_LOMBARD", name: "ICICI Lombard", rating: 4.4, claimRatio: 96.8, logo: "icici-lombard", multiplier: 1.05 },
      { id: "HDFC_ERGO", name: "HDFC ERGO", rating: 4.3, claimRatio: 97.2, logo: "hdfc-ergo", multiplier: 0.98 },
      { id: "BAJAJ_ALLIANZ", name: "Bajaj Allianz General", rating: 4.1, claimRatio: 95.5, logo: "bajaj-allianz", multiplier: 0.92 },
      { id: "TATA_AIG", name: "Tata AIG", rating: 4.2, claimRatio: 96.5, logo: "tata-aig", multiplier: 0.95 }
    ]
  };

  // Generate provider quotes for marketplace
  private static generateProviderQuotes(insuranceType: string, basePremium: number, coverage?: number) {
    const typeKey = insuranceType.toLowerCase().replace(' insurance', '') as keyof typeof this.insuranceProviders;
    const providers = this.insuranceProviders[typeKey] || this.insuranceProviders.health;
    
    return providers.map(provider => ({
      insurerId: provider.id,
      insurerName: provider.name,
      planName: `${insuranceType} ${this.getPlanVariant()}`,
      premium: Math.round(basePremium * provider.multiplier),
      sumInsured: coverage || 500000,
      policyTerm: insuranceType.toLowerCase().includes('life') ? Math.floor(Math.random() * 10) + 20 : 1,
      features: this.getPlanFeatures(insuranceType),
      rating: provider.rating,
      claimSettlementRatio: provider.claimRatio,
      logo: provider.logo,
      specialOffers: this.getSpecialOffers(provider.id),
      benefits: this.getBenefits(insuranceType),
      exclusions: this.getExclusions(insuranceType)
    }));
  }

  private static getPlanVariant(): string {
    const variants = ['Premium Plan', 'Comprehensive Plan', 'Smart Plan', 'Secure Plan', 'Elite Plan', 'Gold Plan'];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private static getPlanFeatures(insuranceType: string): string[] {
    const features = {
      'health insurance': [
        'Cashless hospitalization at 9000+ hospitals',
        'Pre-existing diseases covered after waiting period',
        'Online claim settlement in 30 minutes',
        'No room rent limit',
        'Maternity coverage',
        'Day care procedures covered'
      ],
      'life insurance': [
        'High sum assured at low premium',
        'Tax benefits under Section 80C',
        'Flexible premium payment options',
        'Accidental death benefit',
        'Terminal illness coverage',
        'Loan facility available'
      ],
      'motor insurance': [
        'Cashless claims at 4000+ garages',
        'Zero depreciation coverage',
        '24x7 roadside assistance',
        'Engine protection cover',
        'Return to invoice benefit',
        'Personal accident cover'
      ],
      'travel insurance': [
        'Worldwide medical coverage',
        'Trip cancellation protection',
        'Baggage loss coverage',
        'Flight delay compensation',
        'Adventure sports coverage',
        'Pre-existing conditions covered'
      ],
      'home insurance': [
        'Structure and contents coverage',
        'Natural calamity protection',
        'Burglary and theft coverage',
        'Public liability cover',
        'Temporary accommodation',
        'Loss of rent coverage'
      ]
    };
    
    const typeFeatures = features[insuranceType.toLowerCase() as keyof typeof features] || features['health insurance'];
    return typeFeatures.slice(0, 4); // Return 4 random features
  }

  private static getSpecialOffers(providerId: string): string[] {
    const offers = [
      'Get 10% discount on online purchase',
      'Free health checkup worth ₹2000',
      'No medical tests for sum insured up to ₹5 lakhs',
      '50% discount on second year premium',
      'Refer a friend and get ₹500 cashback'
    ];
    return [offers[Math.floor(Math.random() * offers.length)]];
  }

  private static getBenefits(insuranceType: string): string[] {
    const benefits = {
      'health insurance': [
        'Unlimited restoration of sum insured',
        'Wellness programs and health coaching',
        'Telemedicine consultations included',
        'Annual health checkups covered'
      ],
      'life insurance': [
        'Guaranteed death benefit payout',
        'Flexible premium payment terms',
        'Riders available for additional protection',
        'Loyalty additions for long-term policies'
      ],
      'motor insurance': [
        'No inspection required for new vehicles',
        'Instant policy issuance',
        'Multi-year policy discounts available',
        'Emergency fuel and battery service'
      ],
      'travel insurance': [
        'Coverage in 150+ countries',
        'Instant claims settlement',
        '24/7 travel assistance helpline',
        'COVID-19 coverage included'
      ]
    };
    
    const typeBenefits = benefits[insuranceType.toLowerCase() as keyof typeof benefits] || benefits['health insurance'];
    return typeBenefits.slice(0, 3);
  }

  private static getExclusions(insuranceType: string): string[] {
    const exclusions = {
      'health insurance': [
        'Pre-existing diseases (2-4 year waiting period)',
        'Cosmetic treatments and surgeries',
        'War and nuclear risks',
        'Self-inflicted injuries'
      ],
      'life insurance': [
        'Suicide within first year',
        'Death due to intoxication',
        'War and nuclear risks',
        'Pre-existing terminal illness'
      ],
      'motor insurance': [
        'Normal wear and tear',
        'Mechanical breakdown',
        'Driving under influence',
        'Use for commercial purposes (for private car policy)'
      ],
      'travel insurance': [
        'Pre-existing medical conditions',
        'Adventure sports (unless specifically covered)',
        'Pregnancy-related complications',
        'Travel against government advisory'
      ]
    };
    
    const typeExclusions = exclusions[insuranceType.toLowerCase() as keyof typeof exclusions] || exclusions['health insurance'];
    return typeExclusions.slice(0, 3);
  }

  // Marketplace comparison endpoint
  static async compareInsurancePlans(req: Request, res: Response) {
    try {
      const { insuranceType, selectedProviders, criteria } = req.body;

      if (!insuranceType) {
        return res.status(400).json({
          success: false,
          error: "Insurance type is required"
        });
      }

      const basePremium = this.calculateBasePremium(insuranceType, criteria?.age || 30, criteria?.coverage);
      let quotes = this.generateProviderQuotes(insuranceType, basePremium, criteria?.coverage);

      // Filter by selected providers if specified
      if (selectedProviders && selectedProviders.length > 0) {
        quotes = quotes.filter(quote => selectedProviders.includes(quote.insurerId));
      }

      // Sort by criteria
      if (criteria?.sortBy) {
        quotes.sort((a, b) => {
          switch (criteria.sortBy) {
            case 'premium':
              return a.premium - b.premium;
            case 'rating':
              return b.rating - a.rating;
            case 'claimRatio':
              return b.claimSettlementRatio - a.claimSettlementRatio;
            default:
              return 0;
          }
        });
      }

      res.json({
        success: true,
        data: {
          comparisons: quotes,
          bestValue: quotes.reduce((min, quote) => quote.premium < min.premium ? quote : min),
          topRated: quotes.reduce((max, quote) => quote.rating > max.rating ? quote : max),
          bestClaims: quotes.reduce((max, quote) => quote.claimSettlementRatio > max.claimSettlementRatio ? quote : max),
          comparisonMatrix: this.generateComparisonMatrix(quotes),
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error comparing insurance plans:", error);
      res.status(500).json({
        success: false,
        error: "Failed to compare insurance plans"
      });
    }
  }

  private static generateComparisonMatrix(quotes: any[]) {
    const criteria = ['premium', 'rating', 'claimSettlementRatio', 'features', 'benefits'];
    
    return criteria.map(criterion => ({
      criterion: criterion.charAt(0).toUpperCase() + criterion.slice(1),
      values: quotes.map(quote => ({
        providerId: quote.insurerId,
        value: criterion === 'features' || criterion === 'benefits' 
          ? quote[criterion].length 
          : quote[criterion] || 'N/A'
      }))
    }));
  }

  // Get providers by insurance type
  static getProvidersByType(insuranceType: string) {
    const typeKey = insuranceType.toLowerCase().replace(' insurance', '') as keyof typeof this.insuranceProviders;
    const providers = this.insuranceProviders[typeKey] || this.insuranceProviders.health;
    
    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      rating: provider.rating,
      claimRatio: provider.claimRatio,
      logo: provider.logo,
      specialization: this.getProviderSpecialization(provider.id, insuranceType)
    }));
  }

  private static getProviderSpecialization(providerId: string, insuranceType: string): string[] {
    const specializations = {
      'STAR_HEALTH': ['Family health plans', 'Senior citizen coverage', 'Maternity benefits'],
      'LIC': ['Term insurance', 'Endowment plans', 'Pension schemes'],
      'TATA_AIG': ['Motor insurance', 'Travel insurance', 'Home insurance'],
      'ICICI_LOMBARD': ['Comprehensive coverage', 'Digital services', 'Quick claims'],
      'HDFC_ERGO': ['Health insurance', 'Motor insurance', 'Travel insurance'],
      'BAJAJ_ALLIANZ': ['Life insurance', 'Health insurance', 'Investment plans']
    };
    
    return specializations[providerId as keyof typeof specializations] || ['General insurance solutions'];
  }

  // Private helper methods
  private static calculateBasePremium(insuranceType: string, age: number, coverage?: number): number {
    const baseRates: { [key: string]: number } = {
      'health insurance': 8000,
      'life insurance': 12000,
      'motor insurance': 5000,
      'travel insurance': 1500,
      'home insurance': 3000
    };

    let premium = baseRates[insuranceType.toLowerCase()] || 5000;
    
    // Age-based premium adjustment
    if (age > 50) premium *= 1.8;
    else if (age > 40) premium *= 1.4;
    else if (age > 30) premium *= 1.1;

    // Coverage-based adjustment
    if (coverage) {
      premium *= (coverage / 500000); // Base coverage 5 lakhs
    }

    return Math.round(premium);
  }

  private static getRecommendations(quotes: any[]): string[] {
    const recommendations = [];
    
    // Find cheapest option
    const cheapest = quotes.reduce((min, quote) => quote.premium < min.premium ? quote : min);
    recommendations.push(`Best Value: ${cheapest.insurerName} - ${cheapest.planName}`);
    
    // Find highest rating
    const topRated = quotes.reduce((max, quote) => quote.rating > max.rating ? quote : max);
    recommendations.push(`Highest Rated: ${topRated.insurerName} - ${topRated.rating}/5 rating`);
    
    // Find best claim settlement
    const bestClaims = quotes.reduce((max, quote) => quote.claimSettlementRatio > max.claimSettlementRatio ? quote : max);
    recommendations.push(`Best Claims: ${bestClaims.insurerName} - ${bestClaims.claimSettlementRatio}% settlement ratio`);
    
    return recommendations;
  }
}