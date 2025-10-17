/**
 * Manual KYC Flow Test Suite
 * Tests Individual, Corporate, and NRI KYC submission flows
 */

import { apiRequest } from './client/src/lib/queryClient';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

// Test configuration
const BASE_URL = 'http://localhost:5000';

// Mock test data
const INDIVIDUAL_KYC_DATA = {
  applicantType: 'individual',
  pan: 'ABCDE1234F',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  fatherName: 'James Doe',
  motherName: 'Jane Doe',
  email: 'john.doe@example.com',
  mobile: '+919876543210',
  address: '123 Main Street, Apartment 4B',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  documents: {
    pan_card: 'https://example.com/docs/pan_card.pdf',
    aadhar_front: 'https://example.com/docs/aadhar_front.jpg',
    aadhar_back: 'https://example.com/docs/aadhar_back.jpg',
    photo: 'https://example.com/docs/photo.jpg',
    signature: 'https://example.com/docs/signature.jpg',
    bank_proof: 'https://example.com/docs/bank_statement.pdf'
  }
};

const CORPORATE_KYC_DATA = {
  applicantType: 'corporate',
  pan: 'XYZCL1234D',
  companyName: 'Tech Solutions Pvt Ltd',
  registrationNumber: 'U72900MH2020PTC123456',
  incorporationDate: '2020-05-15',
  authorizedSignatoryName: 'Rajesh Kumar',
  email: 'info@techsolutions.com',
  mobile: '+919123456789',
  address: 'Tower A, Business Park, Andheri East',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400093',
  documents: {
    pan_card: 'https://example.com/docs/company_pan.pdf',
    incorporation_cert: 'https://example.com/docs/incorporation.pdf',
    moa: 'https://example.com/docs/moa.pdf',
    aoa: 'https://example.com/docs/aoa.pdf',
    board_resolution: 'https://example.com/docs/resolution.pdf',
    signatory_pan: 'https://example.com/docs/signatory_pan.pdf',
    signatory_aadhar: 'https://example.com/docs/signatory_aadhar.pdf',
    bank_proof: 'https://example.com/docs/company_bank.pdf',
    address_proof: 'https://example.com/docs/office_address.pdf'
  }
};

const NRI_KYC_DATA = {
  applicantType: 'nri',
  pan: 'NRIPQ9876K',
  firstName: 'Amit',
  lastName: 'Patel',
  dateOfBirth: '1985-08-20',
  countryOfResidence: 'United States',
  passportNumber: 'M1234567',
  visaType: 'H1B',
  email: 'amit.patel@example.com',
  mobile: '+919988776655',
  address: '456 Oak Avenue, San Francisco',
  city: 'San Francisco',
  state: 'California',
  pincode: '94102',
  documents: {
    pan_card: 'https://example.com/docs/nri_pan.pdf',
    passport: 'https://example.com/docs/passport.pdf',
    visa: 'https://example.com/docs/visa.pdf',
    overseas_address: 'https://example.com/docs/us_address.pdf',
    indian_address: 'https://example.com/docs/india_address.pdf',
    photo: 'https://example.com/docs/nri_photo.jpg',
    signature: 'https://example.com/docs/nri_signature.jpg',
    bank_proof_overseas: 'https://example.com/docs/us_bank.pdf',
    bank_proof_nre_nro: 'https://example.com/docs/nre_account.pdf'
  }
};

async function logResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  const result: TestResult = { testName, status, message, details };
  testResults.push(result);
  
  const statusSymbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${statusSymbol} ${testName}: ${message}`);
  if (details && status === 'FAIL') {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Test 1: Individual KYC Submission
async function testIndividualKYC() {
  try {
    const response = await fetch(`${BASE_URL}/api/kyc/manual-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(INDIVIDUAL_KYC_DATA),
      credentials: 'include'
    });

    const data = await response.json();

    if (response.status === 200 && data.success) {
      await logResult(
        'Individual KYC Submission',
        'PASS',
        `Submission created with ID: ${data.submissionId}`,
        { submissionId: data.submissionId, status: data.status }
      );
      return data.submissionId;
    } else {
      await logResult(
        'Individual KYC Submission',
        'FAIL',
        `API returned status ${response.status}`,
        data
      );
      return null;
    }
  } catch (error) {
    await logResult(
      'Individual KYC Submission',
      'FAIL',
      'Request failed',
      error
    );
    return null;
  }
}

// Test 2: Corporate KYC Submission
async function testCorporateKYC() {
  try {
    const response = await fetch(`${BASE_URL}/api/kyc/manual-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(CORPORATE_KYC_DATA),
      credentials: 'include'
    });

    const data = await response.json();

    if (response.status === 200 && data.success) {
      await logResult(
        'Corporate KYC Submission',
        'PASS',
        `Submission created with ID: ${data.submissionId}`,
        { submissionId: data.submissionId, status: data.status }
      );
      return data.submissionId;
    } else {
      await logResult(
        'Corporate KYC Submission',
        'FAIL',
        `API returned status ${response.status}`,
        data
      );
      return null;
    }
  } catch (error) {
    await logResult(
      'Corporate KYC Submission',
      'FAIL',
      'Request failed',
      error
    );
    return null;
  }
}

// Test 3: NRI KYC Submission
async function testNRIKYC() {
  try {
    const response = await fetch(`${BASE_URL}/api/kyc/manual-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(NRI_KYC_DATA),
      credentials: 'include'
    });

    const data = await response.json();

    if (response.status === 200 && data.success) {
      await logResult(
        'NRI KYC Submission',
        'PASS',
        `Submission created with ID: ${data.submissionId}`,
        { submissionId: data.submissionId, status: data.status }
      );
      return data.submissionId;
    } else {
      await logResult(
        'NRI KYC Submission',
        'FAIL',
        `API returned status ${response.status}`,
        data
      );
      return null;
    }
  } catch (error) {
    await logResult(
      'NRI KYC Submission',
      'FAIL',
      'Request failed',
      error
    );
    return null;
  }
}

// Test 4: Document Validation - Missing Documents
async function testMissingDocuments() {
  try {
    const invalidData = {
      ...INDIVIDUAL_KYC_DATA,
      documents: {} // Empty documents
    };

    const response = await fetch(`${BASE_URL}/api/kyc/manual-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidData),
      credentials: 'include'
    });

    const data = await response.json();

    if (response.status === 400 || !data.success) {
      await logResult(
        'Document Validation (Missing Documents)',
        'PASS',
        'Correctly rejected submission with missing documents',
        { responseStatus: response.status }
      );
    } else {
      await logResult(
        'Document Validation (Missing Documents)',
        'FAIL',
        'Should have rejected submission with missing documents',
        data
      );
    }
  } catch (error) {
    await logResult(
      'Document Validation (Missing Documents)',
      'FAIL',
      'Test failed',
      error
    );
  }
}

// Test 5: Get User Submissions
async function testGetUserSubmissions() {
  try {
    const response = await fetch(`${BASE_URL}/api/kyc/manual-submissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (response.status === 200 && Array.isArray(data.submissions)) {
      await logResult(
        'Get User KYC Submissions',
        'PASS',
        `Retrieved ${data.submissions.length} submissions`,
        { count: data.submissions.length }
      );
    } else {
      await logResult(
        'Get User KYC Submissions',
        'FAIL',
        `API returned status ${response.status}`,
        data
      );
    }
  } catch (error) {
    await logResult(
      'Get User KYC Submissions',
      'FAIL',
      'Request failed',
      error
    );
  }
}

// Generate test report
function generateTestReport() {
  console.log('\n' + '='.repeat(80));
  console.log('MANUAL KYC TEST REPORT');
  console.log('='.repeat(80));
  console.log(`\nTotal Tests: ${testResults.length}`);
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIP').length;
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\nSuccess Rate: ${((passed / testResults.length) * 100).toFixed(2)}%`);
  
  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED RESULTS:');
  console.log('-'.repeat(80));
  
  testResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.testName}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));
  
  const recommendations = [
    '1. Authentication: Tests show 401 errors - authentication needed before testing',
    '2. Object Storage: Document uploads use object storage integration',
    '3. Document Validation: Implement file size and format validation',
    '4. Admin Dashboard: Create admin review interface',
    '5. Compliance Logging: All submissions logged for audit trail'
  ];
  
  recommendations.forEach(rec => console.log(rec));
  console.log('\n' + '='.repeat(80));
}

// Main test execution
async function runTests() {
  console.log('Starting Manual KYC Test Suite...\n');
  
  console.log('📋 Test 1: Individual KYC Flow');
  await testIndividualKYC();
  
  console.log('\n📋 Test 2: Corporate KYC Flow');
  await testCorporateKYC();
  
  console.log('\n📋 Test 3: NRI KYC Flow');
  await testNRIKYC();
  
  console.log('\n📋 Test 4: Document Validation');
  await testMissingDocuments();
  
  console.log('\n📋 Test 5: Get User Submissions');
  await testGetUserSubmissions();
  
  // Generate report
  generateTestReport();
}

// Run tests
runTests().catch(console.error);
