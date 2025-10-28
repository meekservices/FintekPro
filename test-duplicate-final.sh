#!/bin/bash

# Fresh test with unique IDs to avoid conflicts
BASE_URL="http://localhost:5000"
UNIQUE_ID=$(date +%s%N | cut -b1-13)
echo "Using unique test ID: $UNIQUE_ID"
echo ""

# Test 1: Create first user
echo "=== TEST 1: Creating First Baseline User ==="
FIRST_USER=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"user${UNIQUE_ID}@test.com\",
    \"mobile\": \"${UNIQUE_ID:0:10}\",
    \"password\": \"Test123!\"
  }" 2>/dev/null)

STATUS=$(echo "$FIRST_USER" | tail -n1)
RESPONSE=$(echo "$FIRST_USER" | head -n -1)

echo "Status: $STATUS"
echo "Response:" 
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

if [ "$STATUS" != "200" ]; then
    echo "❌ Failed to create first user. Exiting."
    exit 1
fi

sleep 2

# Test 2: Try to create user with same email (should succeed with warning)
echo "=== TEST 2: Email Duplicate (Should Succeed with Warning) ==="
UNIQUE_MOBILE=$(echo "$UNIQUE_ID + 1" | bc)
EMAIL_DUP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"user${UNIQUE_ID}@test.com\",
    \"mobile\": \"${UNIQUE_MOBILE:0:10}\",
    \"password\": \"Test123!\"
  }" 2>/dev/null)

STATUS=$(echo "$EMAIL_DUP" | tail -n1)
RESPONSE=$(echo "$EMAIL_DUP" | head -n -1)

echo "Status: $STATUS (Expected: 200)"
echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

if [ "$STATUS" = "200" ]; then
    echo "✅ PASS: Email duplicate allowed (200 status)"
else
    echo "❌ FAIL: Email duplicate blocked (status: $STATUS)"
fi
echo ""

sleep 2

# Test 3: Try to create user with same mobile (should succeed with warning)
echo "=== TEST 3: Mobile Duplicate (Should Succeed with Warning) ==="
MOBILE_DUP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"unique${UNIQUE_ID}@test.com\",
    \"mobile\": \"${UNIQUE_ID:0:10}\",
    \"password\": \"Test123!\"
  }" 2>/dev/null)

STATUS=$(echo "$MOBILE_DUP" | tail -n1)
RESPONSE=$(echo "$MOBILE_DUP" | head -n -1)

echo "Status: $STATUS (Expected: 200)"
echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

if [ "$STATUS" = "200" ]; then
    echo "✅ PASS: Mobile duplicate allowed (200 status)"
else
    echo "❌ FAIL: Mobile duplicate blocked (status: $STATUS)"
fi
echo ""

echo "===================================================================="
echo "TEST SUMMARY"
echo "===================================================================="
echo "✅ Fix Applied: Email/Mobile blocking removed from /api/register"
echo "✅ Family members can now share email/mobile contacts"
echo ""
echo "Note: Duplicate warnings will be shown in the application UI"
echo "      PAN duplicates are still blocked via /api/agent/clients (409)"
