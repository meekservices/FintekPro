#!/bin/bash

# Test Duplicate Detection System (Revised)
# This script tests duplicate detection scenarios using /api/register
# Note: Mobile must be exactly 10 digits (no country code)

BASE_URL="http://localhost:5000"
TIMESTAMP=$(date +%s)

echo "======================================================================"
echo "Duplicate Detection System Test Suite (Revised)"
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

echo "======================================================================"
echo "SETUP: Creating baseline users via /api/register"
echo "======================================================================"
echo ""

# Create baseline user 1
echo "Creating baseline user 1..."
BASELINE_USER_1=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "baseline1@duptest.com",
    "mobile": "9876543210",
    "password": "Test123!",
    "name": "Baseline User One"
  }' 2>/dev/null)

BASELINE1_STATUS=$(echo "$BASELINE_USER_1" | tail -n1)
BASELINE1_RESPONSE=$(echo "$BASELINE_USER_1" | head -n -1)

echo "Baseline User 1 Status: $BASELINE1_STATUS"
if [ "$BASELINE1_STATUS" = "201" ]; then
    BASELINE1_ID=$(echo "$BASELINE1_RESPONSE" | jq -r '.user.id')
    BASELINE1_EMAIL=$(echo "$BASELINE1_RESPONSE" | jq -r '.user.email')
    echo "✅ Created baseline user 1: ID=$BASELINE1_ID, Email=$BASELINE1_EMAIL"
else
    echo "❌ Failed to create baseline user 1"
    echo "$BASELINE1_RESPONSE" | jq '.' 2>/dev/null || echo "$BASELINE1_RESPONSE"
fi
echo ""

sleep 1

# Create baseline user 2
echo "Creating baseline user 2..."
BASELINE_USER_2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "baseline2@duptest.com",
    "mobile": "9876543211",
    "password": "Test123!",
    "name": "Baseline User Two"
  }' 2>/dev/null)

BASELINE2_STATUS=$(echo "$BASELINE_USER_2" | tail -n1)
BASELINE2_RESPONSE=$(echo "$BASELINE_USER_2" | head -n -1)

echo "Baseline User 2 Status: $BASELINE2_STATUS"
if [ "$BASELINE2_STATUS" = "201" ]; then
    BASELINE2_ID=$(echo "$BASELINE2_RESPONSE" | jq -r '.user.id')
    BASELINE2_EMAIL=$(echo "$BASELINE2_RESPONSE" | jq -r '.user.email')
    BASELINE2_MOBILE=$(echo "$BASELINE2_RESPONSE" | jq -r '.user.mobile')
    echo "✅ Created baseline user 2: ID=$BASELINE2_ID, Email=$BASELINE2_EMAIL, Mobile=$BASELINE2_MOBILE"
else
    echo "❌ Failed to create baseline user 2"
    echo "$BASELINE2_RESPONSE" | jq '.' 2>/dev/null || echo "$BASELINE2_RESPONSE"
fi
echo ""

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 1: Email Duplicate Test"
echo "======================================================================"
echo ""
echo "Expected: User created with 201 status, warning shown, emailMatch=true"
echo "Attempting to register user with duplicate email (baseline2@duptest.com)"
echo ""

EMAIL_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"baseline2@duptest.com\",
    \"mobile\": \"${TIMESTAMP:0:10}\",
    \"password\": \"Test123!\",
    \"name\": \"Email Duplicate Test\"
  }" 2>/dev/null)

EMAIL_STATUS=$(echo "$EMAIL_DUPLICATE" | tail -n1)
EMAIL_RESPONSE=$(echo "$EMAIL_DUPLICATE" | head -n -1)

print_result "Email Duplicate Test" "$EMAIL_STATUS" "201" "$EMAIL_RESPONSE"

# Verify emailMatch flag
if echo "$EMAIL_RESPONSE" | jq -e '.warnings.duplicates' > /dev/null 2>&1; then
    echo "✅ VERIFIED: Warnings section present in response"
    
    EMAIL_MATCH=$(echo "$EMAIL_RESPONSE" | jq -r '.warnings.duplicates[0].emailMatch // false')
    if [ "$EMAIL_MATCH" = "true" ]; then
        echo "✅ VERIFIED: emailMatch flag is true"
    else
        echo "❌ FAILED: emailMatch flag is not true (value: $EMAIL_MATCH)"
    fi
    
    # Check mobileMatch should be false
    MOBILE_MATCH=$(echo "$EMAIL_RESPONSE" | jq -r '.warnings.duplicates[0].mobileMatch // false')
    if [ "$MOBILE_MATCH" = "false" ]; then
        echo "✅ VERIFIED: mobileMatch flag is false (correct)"
    else
        echo "⚠️  WARNING: mobileMatch flag is true (unexpected)"
    fi
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$EMAIL_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    NEW_USER_ID=$(echo "$EMAIL_RESPONSE" | jq -r '.user.id')
    echo "✅ VERIFIED: User was created despite duplicate email (ID: $NEW_USER_ID)"
else
    echo "❌ FAILED: User was not created"
fi

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 2: Mobile Duplicate Test"
echo "======================================================================"
echo ""
echo "Expected: User created with 201 status, warning shown, mobileMatch=true"
echo "Attempting to register user with duplicate mobile (9876543211)"
echo ""

MOBILE_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"mobile${TIMESTAMP}@duptest.com\",
    \"mobile\": \"9876543211\",
    \"password\": \"Test123!\",
    \"name\": \"Mobile Duplicate Test\"
  }" 2>/dev/null)

MOBILE_STATUS=$(echo "$MOBILE_DUPLICATE" | tail -n1)
MOBILE_RESPONSE=$(echo "$MOBILE_DUPLICATE" | head -n -1)

print_result "Mobile Duplicate Test" "$MOBILE_STATUS" "201" "$MOBILE_RESPONSE"

# Verify mobileMatch flag
if echo "$MOBILE_RESPONSE" | jq -e '.warnings.duplicates' > /dev/null 2>&1; then
    echo "✅ VERIFIED: Warnings section present in response"
    
    MOBILE_MATCH=$(echo "$MOBILE_RESPONSE" | jq -r '.warnings.duplicates[0].mobileMatch // false')
    if [ "$MOBILE_MATCH" = "true" ]; then
        echo "✅ VERIFIED: mobileMatch flag is true"
    else
        echo "❌ FAILED: mobileMatch flag is not true (value: $MOBILE_MATCH)"
    fi
    
    # Check emailMatch should be false
    EMAIL_MATCH=$(echo "$MOBILE_RESPONSE" | jq -r '.warnings.duplicates[0].emailMatch // false')
    if [ "$EMAIL_MATCH" = "false" ]; then
        echo "✅ VERIFIED: emailMatch flag is false (correct)"
    else
        echo "⚠️  WARNING: emailMatch flag is true (unexpected)"
    fi
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$MOBILE_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    NEW_USER_ID=$(echo "$MOBILE_RESPONSE" | jq -r '.user.id')
    echo "✅ VERIFIED: User was created despite duplicate mobile (ID: $NEW_USER_ID)"
else
    echo "❌ FAILED: User was not created"
fi

sleep 2

echo "======================================================================"
echo "TEST SCENARIO 3: Multiple Match Test (Email + Mobile)"
echo "======================================================================"
echo ""
echo "Expected: User created with 201 status, both emailMatch and mobileMatch true"
echo "Attempting to register user with duplicate email AND mobile"
echo ""

MULTIPLE_DUPLICATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "baseline2@duptest.com",
    "mobile": "9876543211",
    "password": "Test123!",
    "name": "Multiple Duplicate Test"
  }' 2>/dev/null)

MULTIPLE_STATUS=$(echo "$MULTIPLE_DUPLICATE" | tail -n1)
MULTIPLE_RESPONSE=$(echo "$MULTIPLE_DUPLICATE" | head -n -1)

print_result "Multiple Match Test" "$MULTIPLE_STATUS" "201" "$MULTIPLE_RESPONSE"

# Verify both flags
if echo "$MULTIPLE_RESPONSE" | jq -e '.warnings.duplicates' > /dev/null 2>&1; then
    echo "✅ VERIFIED: Warnings section present in response"
    
    # The duplicate detection may return one entry with both flags or multiple entries
    # Let's check the first entry
    EMAIL_MATCH=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates[0].emailMatch // false')
    MOBILE_MATCH=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates[0].mobileMatch // false')
    
    if [ "$EMAIL_MATCH" = "true" ]; then
        echo "✅ VERIFIED: emailMatch flag is true"
    else
        echo "❌ FAILED: emailMatch flag is not true (value: $EMAIL_MATCH)"
    fi
    
    if [ "$MOBILE_MATCH" = "true" ]; then
        echo "✅ VERIFIED: mobileMatch flag is true"
    else
        echo "❌ FAILED: mobileMatch flag is not true (value: $MOBILE_MATCH)"
    fi
    
    # Display duplicate info
    DUP_COUNT=$(echo "$MULTIPLE_RESPONSE" | jq -r '.warnings.duplicates | length')
    echo "   Number of duplicate entries: $DUP_COUNT"
else
    echo "❌ FAILED: No warnings.duplicates found in response"
fi

# Verify user was created
if echo "$MULTIPLE_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    NEW_USER_ID=$(echo "$MULTIPLE_RESPONSE" | jq -r '.user.id')
    echo "✅ VERIFIED: User was created despite duplicate email and mobile (ID: $NEW_USER_ID)"
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
echo "Test 1 - Email Duplicate (should warn): Status $EMAIL_STATUS (expected 201)"
echo "Test 2 - Mobile Duplicate (should warn): Status $MOBILE_STATUS (expected 201)"
echo "Test 3 - Multiple Match (should warn): Status $MULTIPLE_STATUS (expected 201)"
echo ""
echo "Note: PAN duplicate testing requires authentication via /api/agent/clients"
echo "      PAN duplicates are blocked with 409 status in that endpoint"
echo ""
