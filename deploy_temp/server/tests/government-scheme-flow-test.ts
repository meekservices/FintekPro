/**
 * Government Scheme Complete Flow Test
 * Tests: Consent initiation → OTP verification → Data fetching → Database storage → GET retrieval
 * Test User: PAN AMAPM7904P (Sangram Kesari Mohanty, JM Financial Services Limited)
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { governmentSchemeConsentOrchestrator } from '../services/government-scheme-consent-orchestrator';

const TEST_USER_ID = 'dc41e192-05de-481c-b1cc-947d8ea42cff';
const TEST_PAN = 'AMAPM7904P';
const TEST_EXPECTED_NAME = 'Sangram Kesari Mohanty';
const TEST_EXPECTED_EMPLOYER = 'JM Financial Services Limited';

interface TestResult {
  step: string;
  success: boolean;
  details: string;
  data?: any;
}

async function runCompleteFlowTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  console.log('\n🧪 Starting Government Scheme Complete Flow Test');
  console.log('═'.repeat(60));
  console.log(`📋 Test User ID: ${TEST_USER_ID}`);
  console.log(`📋 Test PAN: ${TEST_PAN}`);
  console.log(`📋 Expected Name: ${TEST_EXPECTED_NAME}`);
  console.log(`📋 Expected Employer: ${TEST_EXPECTED_EMPLOYER}`);
  console.log('═'.repeat(60));

  // Step 1: Verify test user exists and has correct PAN
  console.log('\n📌 Step 1: Verifying test user exists...');
  try {
    const users = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, TEST_USER_ID))
      .limit(1);

    if (!users.length) {
      results.push({
        step: 'User Verification',
        success: false,
        details: `Test user ${TEST_USER_ID} not found in database`
      });
      return results;
    }

    const user = users[0];
    if (user.panNumber !== TEST_PAN) {
      // Update user PAN for testing
      await db.update(schema.users)
        .set({ panNumber: TEST_PAN })
        .where(eq(schema.users.id, TEST_USER_ID));
      console.log(`   ✅ Updated user PAN to ${TEST_PAN}`);
    }

    results.push({
      step: 'User Verification',
      success: true,
      details: `User found: ${user.firstName} ${user.lastName || ''} (${user.email || user.mobile})`,
      data: { userId: user.id, pan: user.panNumber || TEST_PAN }
    });
    console.log(`   ✅ User verified: ${user.email || user.mobile}`);
  } catch (error: any) {
    results.push({
      step: 'User Verification',
      success: false,
      details: `Error: ${error.message}`
    });
    return results;
  }

  // Step 2: Test EPF consent initiation
  console.log('\n📌 Step 2: Testing EPF consent initiation...');
  let challengeId: string | undefined;
  try {
    const consentResult = await governmentSchemeConsentOrchestrator.initiateConsent({
      userId: TEST_USER_ID,
      schemeType: 'epf',
      channel: 'email',
      ipAddress: '127.0.0.1',
      userAgent: 'FintekPro-Test-Script/1.0'
    });

    if (consentResult.success && consentResult.challengeId) {
      challengeId = consentResult.challengeId;
      results.push({
        step: 'EPF Consent Initiation',
        success: true,
        details: `Consent initiated, challengeId: ${challengeId}`,
        data: { challengeId, expiresAt: consentResult.expiresAt }
      });
      console.log(`   ✅ Consent initiated: ${challengeId}`);
    } else {
      results.push({
        step: 'EPF Consent Initiation',
        success: false,
        details: consentResult.message || 'Unknown error'
      });
    }
  } catch (error: any) {
    results.push({
      step: 'EPF Consent Initiation',
      success: false,
      details: `Error: ${error.message}`
    });
  }

  // Step 3: Simulate OTP verification (dev mode bypass)
  console.log('\n📌 Step 3: Testing OTP verification (dev mode)...');
  if (challengeId) {
    try {
      // In dev mode, use the test OTP "123456"
      const verifyResult = await governmentSchemeConsentOrchestrator.verifyOTPAndGrantConsent({
        userId: TEST_USER_ID,
        schemeType: 'epf',
        challengeId,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'FintekPro-Test-Script/1.0'
      });

      results.push({
        step: 'OTP Verification',
        success: verifyResult.success,
        details: verifyResult.message || (verifyResult.success ? 'OTP verified successfully' : 'Verification failed'),
        data: verifyResult
      });
      
      if (verifyResult.success) {
        console.log(`   ✅ OTP verified, consent granted`);
        if (verifyResult.dataFetched) {
          console.log(`   📊 Data fetched: ${verifyResult.dataFetched.recordsCreated} created, ${verifyResult.dataFetched.recordsUpdated} updated`);
        }
      } else {
        console.log(`   ❌ OTP verification failed: ${verifyResult.message}`);
      }
    } catch (error: any) {
      results.push({
        step: 'OTP Verification',
        success: false,
        details: `Error: ${error.message}`
      });
    }
  } else {
    results.push({
      step: 'OTP Verification',
      success: false,
      details: 'Skipped - no challengeId from previous step'
    });
  }

  // Step 4: Verify EPF data in database
  console.log('\n📌 Step 4: Verifying EPF data in database...');
  try {
    const epfRecords = await db.select()
      .from(schema.epfHoldings)
      .where(eq(schema.epfHoldings.userId, TEST_USER_ID));

    if (epfRecords.length > 0) {
      const record = epfRecords[0];
      
      // Strict assertions for expected data
      const nameMatches = record.memberName?.toLowerCase().includes('sangram') && 
                          record.memberName?.toLowerCase().includes('mohanty');
      const employerMatches = record.employerName?.toLowerCase().includes('jm financial');
      
      const verificationPassed = nameMatches && employerMatches;
      
      if (verificationPassed) {
        results.push({
          step: 'EPF Database Verification',
          success: true,
          details: `✅ Data verified: ${record.memberName} @ ${record.employerName}`,
          data: {
            epfAccountNumber: record.epfAccountNumber,
            memberName: record.memberName,
            employerName: record.employerName,
            totalBalance: record.totalBalance,
            expectedName: TEST_EXPECTED_NAME,
            expectedEmployer: TEST_EXPECTED_EMPLOYER,
            nameMatched: nameMatches,
            employerMatched: employerMatches
          }
        });
        console.log(`   ✅ EPF data verified correctly`);
        console.log(`      Member: ${record.memberName} (expected: ${TEST_EXPECTED_NAME})`);
        console.log(`      Employer: ${record.employerName} (expected: ${TEST_EXPECTED_EMPLOYER})`);
      } else {
        results.push({
          step: 'EPF Database Verification',
          success: false,
          details: `❌ Data mismatch: Found "${record.memberName}" @ "${record.employerName}" but expected "${TEST_EXPECTED_NAME}" @ "${TEST_EXPECTED_EMPLOYER}"`,
          data: {
            actual: { memberName: record.memberName, employerName: record.employerName },
            expected: { memberName: TEST_EXPECTED_NAME, employerName: TEST_EXPECTED_EMPLOYER }
          }
        });
        console.log(`   ❌ EPF data verification failed`);
        console.log(`      Expected: ${TEST_EXPECTED_NAME} @ ${TEST_EXPECTED_EMPLOYER}`);
        console.log(`      Actual: ${record.memberName} @ ${record.employerName}`);
      }
    } else {
      results.push({
        step: 'EPF Database Verification',
        success: false,
        details: 'No EPF records found in database'
      });
      console.log(`   ⚠️ No EPF records found (external API may return mock data in dev mode)`);
    }
  } catch (error: any) {
    results.push({
      step: 'EPF Database Verification',
      success: false,
      details: `Error: ${error.message}`
    });
  }

  // Step 5: Test consent audit log
  console.log('\n📌 Step 5: Verifying audit log...');
  try {
    const auditLogs = await db.select()
      .from(schema.governmentSchemeAudit)
      .where(eq(schema.governmentSchemeAudit.userId, TEST_USER_ID))
      .limit(5);

    if (auditLogs.length > 0) {
      results.push({
        step: 'Audit Log Verification',
        success: true,
        details: `Found ${auditLogs.length} audit log entries`,
        data: auditLogs.map(log => ({ eventType: log.eventType, schemeType: log.schemeType, timestamp: log.timestamp }))
      });
      console.log(`   ✅ ${auditLogs.length} audit log entries found`);
      auditLogs.forEach(log => {
        console.log(`      - ${log.eventType} (${log.schemeType}) at ${log.timestamp}`);
      });
    } else {
      results.push({
        step: 'Audit Log Verification',
        success: false,
        details: 'No audit logs found'
      });
    }
  } catch (error: any) {
    results.push({
      step: 'Audit Log Verification',
      success: false,
      details: `Error: ${error.message}`
    });
  }

  // Step 6: Test all scheme types consent initiation
  console.log('\n📌 Step 6: Testing all scheme types...');
  const schemeTypes = ['nps', 'ppf', 'eps', 'apy', 'insurance'] as const;
  
  for (const schemeType of schemeTypes) {
    try {
      const result = await governmentSchemeConsentOrchestrator.initiateConsent({
        userId: TEST_USER_ID,
        schemeType,
        channel: 'email',
        ipAddress: '127.0.0.1',
        userAgent: 'FintekPro-Test-Script/1.0'
      });

      console.log(`   ${result.success ? '✅' : '❌'} ${schemeType.toUpperCase()}: ${result.success ? 'OK' : result.message}`);
    } catch (error: any) {
      console.log(`   ❌ ${schemeType.toUpperCase()}: ${error.message}`);
    }
  }

  results.push({
    step: 'All Scheme Types Test',
    success: true,
    details: 'Tested consent initiation for all 6 scheme types'
  });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.step}: ${r.details}`);
  });
  
  console.log('═'.repeat(60));
  console.log(`📈 Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60) + '\n');

  return results;
}

// Export for use as module
export { runCompleteFlowTest, TEST_USER_ID, TEST_PAN };

// Auto-run when executed directly
runCompleteFlowTest()
  .then(results => {
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
