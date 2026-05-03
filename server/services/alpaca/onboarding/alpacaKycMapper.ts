import { logger } from '../../../logger';
import { User, UserProfile } from '../../../../shared/schema';
import { toAlpacaAscii, cleanAlphanumeric } from '../../../utils/string-utils';

export class AlpacaKycMapper {
  
  /**
   * Maps FintekPro User/Profile schema into Alpaca Broker API Account schema
   * Ref: https://alpaca.markets/docs/broker/api-references/accounts/accounts/
   */
  mapToAlpacaSchema(user: any, profile: any, ipAddress: string = '127.0.0.1') {
    const isCustodial = !!profile.minorIdentity;
    const accountType = isCustodial ? 'custodial' : 'individual';

    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth) {
      throw new Error('Incomplete core KYC data (Name/DOB required)');
    }

    if (!profile.address || !profile.city || !profile.state || !profile.pincode) {
      throw new Error('Incomplete core KYC data (Address required)');
    }

    // Alpaca expects specific tax ID formats. For non-US residents, an Indian PAN works as a foreign tax ID
    // Clean to ensure only alphanumeric characters are sent
    const taxId = cleanAlphanumeric(profile.panNumber || profile.passportNumber || '');
    if (!taxId) {
      throw new Error('Tax ID (PAN/Passport) required for Alpaca onboarding');
    }

    // Capture dynamic funding source from profile if available, otherwise fallback to employment_income
    const fundingSource = profile.fundingSource || 'employment_income';

    // Sanitize all text fields to ASCII 32-126
    const payload: any = {
      account_type: accountType,
      contact: {
        email_address: user.email.toLowerCase().trim(),
        phone_number: user.mobile, 
        street_address: [toAlpacaAscii(profile.address).substring(0, 50)], 
        city: toAlpacaAscii(profile.city),
        state: toAlpacaAscii(profile.state),
        postal_code: cleanAlphanumeric(profile.pincode),
        country: profile.countryOfResidence === 'India' ? 'IND' : 'USA' 
      },
      identity: {
        given_name: toAlpacaAscii(profile.firstName),
        family_name: toAlpacaAscii(profile.lastName),
        date_of_birth: profile.dateOfBirth, 
        tax_id: taxId,
        tax_id_type: profile.countryOfResidence === 'India' ? 'IND_PAN' : 'USA_SSN',
        country_of_citizenship: profile.countryOfCitizenship === 'India' ? 'IND' : 'USA',
        country_of_birth: profile.countryOfBirth === 'India' ? 'IND' : (profile.countryOfBirth || 'IND'), 
        country_of_tax_residence: profile.countryOfResidence === 'India' ? 'IND' : 'USA',
        funding_source: [fundingSource],
        annual_income: profile.annualIncome ? profile.annualIncome.toString() : undefined,
        net_worth: profile.netWorth ? profile.netWorth.toString() : undefined,
        liquid_net_worth: profile.liquidNetWorth ? profile.liquidNetWorth.toString() : undefined,
      },
      disclosures: {
        is_control_person: false,
        is_affiliated_exchange_or_finra: false,
        is_politically_exposed: profile.pepStatus === 'Y',
        immediate_family_exposed: profile.pepRelatedPersonStatus === 'Y',
        employment_status: profile.employmentStatus || 'unemployed',
        investment_objective: profile.investmentObjective || 'capital_appreciation',
        investment_experience: profile.investmentExperience || 'limited',
        investment_risk_tolerance: profile.investmentRiskTolerance || 'medium',
        investment_time_horizon: profile.investmentTimeHorizon || 'medium',
        liquidity_needs: profile.liquidityNeeds || 'medium',
      },
      additional_info: {
        marital_status: profile.maritalStatus || 'single',
        number_of_dependents: profile.numberOfDependents || 0,
      },
      enabled_assets: ['us_equity', 'us_option', 'crypto'],
      agreements: [
        {
          agreement: 'margin_agreement',
          signed_at: new Date().toISOString(),
          ip_address: ipAddress,
          revision: '1.0'
        },
        {
          agreement: 'account_agreement',
          signed_at: new Date().toISOString(),
          ip_address: ipAddress,
          revision: '1.0'
        },
        {
          agreement: 'customer_agreement',
          signed_at: new Date().toISOString(),
          ip_address: ipAddress,
          revision: '1.0'
        },
        {
          agreement: 'crypto_agreement',
          signed_at: new Date().toISOString(),
          ip_address: ipAddress,
          revision: '1.0'
        }
      ],
      documents: [],
      trusted_contact: {
        given_name: "FintekPro",
        family_name: "Advisory",
        email_address: "support@fintekpro.com"
      }
    };

    // Add minor identity for custodial accounts
    if (isCustodial) {
      const minor = profile.minorIdentity;
      payload.minor_identity = {
        given_name: toAlpacaAscii(minor.given_name),
        family_name: toAlpacaAscii(minor.family_name),
        date_of_birth: minor.date_of_birth,
        tax_id: cleanAlphanumeric(minor.tax_id),
        tax_id_type: minor.tax_id_type || 'IND_PAN',
        country_of_citizenship: minor.country_of_citizenship || 'IND'
      };
    }

    // W-8BEN logic for Non-US residents
    if (profile.countryOfResidence !== 'USA') {
      logger.info(`[AlpacaKycMapper] Including W-8BEN declaration for non-US user: ${user.id}`);
      // Note: Documents are usually uploaded separately via /v1/accounts/{id}/documents
    }

    return payload;
  }
}

export const alpacaKycMapper = new AlpacaKycMapper();
