#!/bin/bash
# Deploy a single Cloud Function or a few specific functions
# Usage: ./deploy-single-function.sh functionName1 functionName2 ...
# Example: ./deploy-single-function.sh onLeagueChatMessage manualTrigger

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 functionName1 [functionName2] ..."
    echo "Example: $0 onLeagueChatMessage manualTrigger"
    echo ""
    echo "Available functions (from functions/index.js exports):"
    echo ""
    # Derived from the codebase so this list can't drift. Requires
    # functions/node_modules to be installed (cd functions && npm install).
    if (cd functions && node -e "
        const names = Object.keys(require('./index.js')).sort();
        for (let i = 0; i < names.length; i += 4) {
            console.log('    ' + names.slice(i, i + 4).join(', '));
        }
    " 2>/dev/null); then
        :
    else
        echo "    (could not load functions/index.js — run: cd functions && npm install)"
    fi
    exit 1
fi

# Build the functions list
FUNCTIONS=""
for func in "$@"; do
    if [ -z "$FUNCTIONS" ]; then
        FUNCTIONS="functions:$func"
    else
        FUNCTIONS="$FUNCTIONS,functions:$func"
    fi
done

echo "Deploying functions: $@"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Deploy
firebase deploy --only "$FUNCTIONS" --force

if [ $? -eq 0 ]; then
    echo ""
    echo "Deployment successful!"
else
    echo ""
    echo "Deployment failed. Check the errors above."
    exit 1
fi
