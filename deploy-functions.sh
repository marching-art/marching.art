#!/bin/bash
# Deploy Cloud Functions with CORS fixes
# This script deploys the updated Cloud Functions to Firebase

echo "🚀 Deploying Cloud Functions to Firebase..."
echo ""
echo "Functions being deployed:"
echo "  ✓ updateProfile (CORS fix)"
echo "  ✓ getPublicProfile (CORS fix)"
echo "  ✓ All other functions"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
echo "🔐 Checking Firebase authentication..."
firebase login:list

# Deploy functions
echo ""
echo "📦 Installing function dependencies..."
cd functions && npm install && cd ..

echo ""
echo "🔥 Deploying to Firebase..."
firebase deploy --only functions

# Check deployment status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "The following functions should now work without CORS errors:"
    echo "  ✓ updateProfile"
    echo "  ✓ getPublicProfile"
    echo "  ✓ getStaffMarketplace"
    echo ""
    echo "Test the deployment at: https://www.marching.art/profile"
else
    echo ""
    echo "❌ Deployment failed. Check the errors above."
    echo ""
    echo "Common issues:"
    echo "  • Not logged in: Run 'firebase login'"
    echo "  • Wrong project: Run 'firebase use marching-art'"
    echo "  • Permission denied: Check Firebase project permissions"
fi
