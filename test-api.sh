#!/bin/bash

# Test Script for Daily Reminder API
echo "🧪 Testing Daily Reminder Configuration API..."
echo "========================================="

BASE_URL="http://localhost:3001/api"

echo ""
echo "1. Testing API Ping..."
curl -s "$BASE_URL/daily-reminders/test-ping" | jq '.' || echo "❌ Ping failed"

echo ""
echo "2. Testing Get Configuration..."
curl -s "$BASE_URL/daily-reminders/config" | jq '.' || echo "❌ Get config failed"

echo ""
echo "3. Testing Search Contacts..."
curl -s "$BASE_URL/daily-reminders/search-contacts?q=" | jq '.' || echo "❌ Search contacts failed"

echo ""
echo "4. Testing Generate Draft..."
curl -s -X POST "$BASE_URL/daily-reminders/generate-draft" | jq '.' || echo "❌ Generate draft failed"

echo ""
echo "5. Testing Learning Settings..."
curl -s "$BASE_URL/learning/settings" | jq '.' || echo "❌ Learning settings failed"

echo ""
echo "6. Testing Learning Stats..."
curl -s "$BASE_URL/learning/stats" | jq '.' || echo "❌ Learning stats failed"

echo ""
echo "7. Testing Learning Pending..."
curl -s "$BASE_URL/learning/pending" | jq '.' || echo "❌ Learning pending failed"

echo ""
echo "✅ API Tests completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Check that all endpoints return success: true"
echo "   2. Verify the frontend can connect to these APIs"
echo "   3. Test the configuration UI in the browser"
echo "   4. Run the test suite in the Testing tab"