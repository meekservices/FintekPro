import { logger } from '../../../logger';
import { User, UserProfile } from '../../../../shared/schema';

export class AlpacaKycMapper {
  
  /**
   * Maps FintekPro User/Profile schema into Alpaca Broker API Account schema
   * Ref: https://alpaca.markets/docs/broker/api-references/accounts/accounts/
   */
  mapToAlpacaSchema(user: User, profile: UserProfile) {
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

    const payload: any = {
      contact: {
        email_address: user.email,
        phone_number: user.mobile, // Needs +91 formatting generally
        street_address: [profile.address.substring(0, 50)], // Max lengths
        city: profile.city,
        state: profile.state,
        postal_code: profile.pincode,
        country: profile.countryOfResidence === 'India' ? 'IND' : 'USA' // ISO-3
      },
      identity: {
        given_name: profile.firstName,
        family_name: profile.lastName,
        date_of_birth: profile.dateOfBirth, // YYYY-MM-DD
        tax_id: taxId,
        tax_id_type: profile.countryOfResidence === 'India' ? 'IND_PAN' : 'USA_SSN',
        country_of_citizenship: profile.countryOfCitizenship === 'India' ? 'IND' : 'USA',
        country_of_birth: 'IND', // Assuming from profile
        country_of_tax_residence: profile.countryOfResidence === 'India' ? 'IND' : 'USA',
        funding_source: ['employment_income']
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
          ip_address: '127.0.0.1', // Should ideally be passed from request
          revision: '1.0'
        },
        {
          agreement: 'account_agreement',
          signed_at: new Date().toISOString(),
          ip_address: '127.0.0.1',
          revision: '1.0'
        },
        {
          agreement: 'customer_agreement',
          signed_at: new Date().toISOString(),
          ip_address: '127.0.0.1',
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

    // If Non-US resident, Alpaca requires W-8BEN declaration implicitly or explicitly via document upload
    if (profile.countryOfResidence !== 'USA') {
      logger.info(`[AlpacaKycMapper] Mapping W-8BEN requirements for non-US user: ${user.id}`);
      // Usually, the W-8BEN is attached as a document later in the flow
    }

    return payload;
  }
}

export const alpacaKycMapper = new AlpacaKycMapper();
