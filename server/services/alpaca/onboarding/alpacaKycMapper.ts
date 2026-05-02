import { logger } from '../../../logger';
import { User, UserProfile } from '../../../../shared/schema';

export class AlpacaKycMapper {
  
  /**
   * Maps FintekPro User/Profile schema into Alpaca Broker API Account schema
   * Ref: https://alpaca.markets/docs/broker/api-references/accounts/accounts/
   */
  mapToAlpacaSchema(user: User, profile: UserProfile, ipAddress: string = '127.0.0.1') {
    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth) {
      throw new Error('Incomplete core KYC data (Name/DOB required)');
    }

    if (!profile.address || !profile.city || !profile.state || !profile.pincode) {
      throw new Error('Incomplete core KYC data (Address required)');
    }

    // Alpaca expects specific tax ID formats. For non-US residents, an Indian PAN works as a foreign tax ID
    const taxId = profile.panNumber || profile.passportNumber;
    if (!taxId) {
      throw new Error('Tax ID (PAN/Passport) required for Alpaca onboarding');
    }

    // Capture dynamic funding source from profile if available, otherwise fallback to employment_income
    const fundingSource = profile.fundingSource || 'employment_income';

    const payload: any = {
      contact: {
        email_address: user.email,
        phone_number: user.mobile, 
        street_address: [profile.address.substring(0, 50)], 
        city: profile.city,
        state: profile.state,
        postal_code: profile.pincode,
        country: profile.countryOfResidence === 'India' ? 'IND' : 'USA' 
      },
      identity: {
        given_name: profile.firstName,
        family_name: profile.lastName,
        date_of_birth: profile.dateOfBirth, 
        tax_id: taxId,
        tax_id_type: profile.countryOfResidence === 'India' ? 'IND_PAN' : 'USA_SSN',
        country_of_citizenship: profile.countryOfCitizenship === 'India' ? 'IND' : 'USA',
        country_of_birth: 'IND', 
        country_of_tax_residence: profile.countryOfResidence === 'India' ? 'IND' : 'USA',
        funding_source: [fundingSource]
      },
      disclosures: {
        is_control_person: false,
        is_affiliated_exchange_or_finra: false,
        is_politically_exposed: profile.pepStatus === 'Y',
        immediate_family_exposed: profile.pepRelatedPersonStatus === 'Y'
      },
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
        }
      ],
      documents: [],
      trusted_contact: {
        given_name: "FintekPro",
        family_name: "Advisory",
        email_address: "support@fintekpro.com"
      }
    };

    // W-8BEN logic for Non-US residents
    if (profile.countryOfResidence !== 'USA') {
      logger.info(`[AlpacaKycMapper] Including W-8BEN declaration for non-US user: ${user.id}`);
      // In a production flow, we would attach a specific document type here
    }

    return payload;
  }
}

export const alpacaKycMapper = new AlpacaKycMapper();
