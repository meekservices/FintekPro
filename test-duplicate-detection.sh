#!/bin/bash

# Test Duplicate Detection System
# This script tests all 4 scenarios for duplicate detection

BASE_URL="http://localhost:5000"
TIMESTAMP=$(date +%s)

echo "======================================================================"
echo "Duplicate Detection System Test Suite"
echo "======================================================================"
echo ""

# Helper function to print test results
print_result() {
    local test_name="$1"
    local status_code="$2"
    local expected_status="$3"
    local response="$4"
    
    echo "----------------------------------------------------------------------"
    echo "TEST: $test_name"
    echo "----------------------------------------------------------------------"
    echo "Expected Status: $expected_status"
    echo "Actual Status: $status_code"
    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "✅ PASSED - Status code matches expected"
    else
        echo "❌ FAILED - Status code mismatch"
    fi
    echo ""
}

# First, create a base user through /api/agent/clients to establish baseline
echo "======================================================================"
echo "SETUP: Creating baseline user via /api/agent/clients"
echo "======================================================================"
echo ""

# Get admin token (assuming there's a test admin user)
# For this test, we'll create users directly via /api/agent/clients

# Create baseline user 1 with PAN
BASELINE_USER_1=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/agent/clients" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "TestBase",
    "lastName": "User1",
    "email": "baseline1@test.com",
    "mobile": "+919876543210",
    "panNumber": "ABCDE1234F"
  }' 2>/dev/null)

BASELINE_STATUS=$(echo "$BASELINE_USER_1" | tail -n1)
BASELINE_RESPONSE=$(echo "$BASELINE_USER_1" | head -n -1)

echo "Baseline User 1 Created:"
echo "$BASELINE_RESPONSE" | jq '.' 2>/dev/null || echo "$BASELINE_RESPONSE"
echo "Status: $BASELINE_STATUS"
echo ""

# Create baseline user 2 for email/mobile tests
BASELINE_USER_2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/agent/clients" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "TestBase",
    "lastName": "User2",
    "email": "baseline2@test.com",
    "mobile": "+919876543211",
    "panNumber": "FGHIJ5678K"
  }' 2>/dev/null)

BASELINE2_STATUS=$(echo "$BASELINE_USER_2" | tail -n1)
BASELINE2_RESPONSE=$(echo "$BASELINE_USER_2" | head -n -1)

echo "Baseline User 2 Created:"
echo "$BASELINE2_RESPONSE" | jq '.' 2>/dev/null || echo "$BASELINE2_RESPONSE"
echo "Status: $BASELINE2_STATUS"
echo ""

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 1: PAN Duplicate Test via /api/agent/clients"
echo "======================================================================"
echo ""
echo "Attempting to create user with duplicate PAN (ABCDE1234F)"
echo ""

PAN_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/agent/clients" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Duplicate",
    "lastName": "PANUser",
    "email": "newuser@test.com",
    "mobile": "+919999999999",
    "panNumber": "ABCDE1234F"
  }' 2>/dev/null)

PAN_STATUS=$(echo "$PAN_DUPLICATE" | tail -n1)
PAN_RESPONSE=$(echo "$PAN_DUPLICATE" | head -n -1)

print_result "PAN Duplicate Test" "$PAN_STATUS" "409" "$PAN_RESPONSE"

# Verify panNumberMatch flag
if echo "$PAN_RESPONSE" | jq -e '.existingClients' > /dev/null 2>&1; then
    echo "✅ VERIFIED: Response contains existingClients information"
    echo "   PAN Number in response: $(echo "$PAN_RESPONSE" | jq -r '.existingClients[0].panNumber')"
else
    echo "❌ FAILED: Expected existingClients in response"
fi

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 2: Email Duplicate Test via /api/register"
echo "======================================================================"
echo ""
echo "Attempting to register user with duplicate email (baseline2@test.com)"
echo ""

EMAIL_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"baseline2@test.com\",
    \"mobile\": \"+91${TIMESTAMP}1\",
    \"password\": \"Test123!\",
    \"name\": \"Email Duplicate Test\"
  }" 2>/dev/null)

EMAIL_STATUS=$(echo "$EMAIL_DUPLICATE" | tail -n1)
EMAIL_RESPONSE=$(echo "$EMAIL_DUPLICATE" | head -n -1)

print_result "Email Duplicate Test" "$EMAIL_STATUS" "201" "$EMAIL_RESPONSE"

# Verify emailMatch flag
if echo "$EMAIL_RESPONSE" | jq -e '.warnings.duplicates[0].emailMatch' > /dev/null 2>&1; then
    EMAIL_MATCH=$(echo "$EMAIL_RESPONSE" | jq -r '.warnings.duplicates[0].emailMatch')
    if [ "$EMAIL_MATCH" = "true" ]; then
        echo "✅ VERIFIED: emailMatch flag is true"
    else
        echo "❌ FAILED: emailMatch flag is not true"
    fi
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$EMAIL_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    echo "✅ VERIFIED: User was created despite duplicate email"
    echo "   User ID: $(echo "$EMAIL_RESPONSE" | jq -r '.user.id')"
else
    echo "❌ FAILED: User was not created"
fi

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 3: Mobile Duplicate Test via /api/register"
echo "======================================================================"
echo ""
echo "Attempting to register user with duplicate mobile (+919876543211)"
echo ""

MOBILE_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"mobile${TIMESTAMP}@test.com\",
    \"mobile\": \"+919876543211\",
    \"password\": \"Test123!\",
    \"name\": \"Mobile Duplicate Test\"
  }" 2>/dev/null)

MOBILE_STATUS=$(echo "$MOBILE_DUPLICATE" | tail -n1)
MOBILE_RESPONSE=$(echo "$MOBILE_DUPLICATE" | head -n -1)

print_result "Mobile Duplicate Test" "$MOBILE_STATUS" "201" "$MOBILE_RESPONSE"

# Verify mobileMatch flag
if echo "$MOBILE_RESPONSE" | jq -e '.warnings.duplicates[0].mobileMatch' > /dev/null 2>&1; then
    MOBILE_MATCH=$(echo "$MOBILE_RESPONSE" | jq -r '.warnings.duplicates[0].mobileMatch')
    if [ "$MOBILE_MATCH" = "true" ]; then
        echo "✅ VERIFIED: mobileMatch flag is true"
    else
        echo "❌ FAILED: mobileMatch flag is not true"
    fi
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$MOBILE_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    echo "✅ VERIFIED: User was created despite duplicate mobile"
    echo "   User ID: $(echo "$MOBILE_RESPONSE" | jq -r '.user.id')"
else
    echo "❌ FAILED: User was not created"
fi

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 4: Multiple Match Test (Email + Mobile) via /api/register"
echo "======================================================================"
echo ""
echo "Attempting to register user with duplicate email AND mobile"
echo ""

MULTIPLE_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "baseline2@test.com",
    "mobile": "+919876543211",
    "password": "Test123!",
    "name": "Multiple Duplicate Test"
  }' 2>/dev/null)

MULTIPLE_STATUS=$(echo "$MULTIPLE_DUPLICATE" | tail -n1)
MULTIPLE_RESPONSE=$(echo "$MULTIPLE_DUPLICATE" | head -n -1)

print_result "Multiple Match Test" "$MULTIPLE_STATUS" "201" "$MULTIPLE_RESPONSE"

# Verify both flags
if echo "$MULTIPLE_RESPONSE" | jq -e '.warnings.duplicates' > /dev/null 2>&1; then
    # Check if we have duplicate warnings
    DUPLICATE_COUNT=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates | length')
    echo "   Number of duplicate warnings: $DUPLICATE_COUNT"
    
    # Check for email match
    EMAIL_MATCH=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates[0].emailMatch // false')
    if [ "$EMAIL_MATCH" = "true" ]; then
        echo "✅ VERIFIED: emailMatch flag is true"
    else
        echo "⚠️  WARNING: emailMatch flag is not true"
    fi
    
    # Check for mobile match
    MOBILE_MATCH=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates[0].mobileMatch // false')
    if [ "$MOBILE_MATCH" = "true" ]; then
        echo "✅ VERIFIED: mobileMatch flag is true"
    else
        echo "⚠️  WARNING: mobileMatch flag is not true"
    fi
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$MULTIPLE_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    echo "✅ VERIFIED: User was created despite duplicate email and mobile"
    echo "   User ID: $(echo "$MULTIPLE_RESPONSE" | jq -r '.user.id')"
else
    echo "❌ FAILED: User was not created"
fi

echo ""
echo "======================================================================"
echo "TEST SUITE COMPLETE"
echo "======================================================================"
echo ""
echo "Summary:"
echo "--------"
echo "Test 1 - PAN Duplicate (should block): Status $PAN_STATUS (expected 409)"
echo "Test 2 - Email Duplicate (should warn): Status $EMAIL_STATUS (expected 201)"
echo "Test 3 - Mobile Duplicate (should warn): Status $MOBILE_STATUS (expected 201)"
echo "Test 4 - Multiple Match (should warn): Status $MULTIPLE_STATUS (expected 201)"
echo ""
