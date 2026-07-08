#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=== Angular App Deployment Script ===${NC}"

# Load environment variables from .env file
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

# Validate required environment variables
REQUIRED_VARS=("DEPLOY_STAGE" "S3_BUCKET" "CLOUDFRONT_DISTRIBUTION_ID" "AWS_REGION")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: Required environment variable '$var' is not set in .env${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✓ Environment variables loaded${NC}"
echo -e "${BLUE}Stage: ${YELLOW}$DEPLOY_STAGE${NC}"
echo -e "${BLUE}S3 Bucket: ${YELLOW}$S3_BUCKET${NC}"
echo -e "${BLUE}CloudFront Distribution: ${YELLOW}$CLOUDFRONT_DISTRIBUTION_ID${NC}"
echo -e "${BLUE}AWS Region: ${YELLOW}$AWS_REGION${NC}"

# Step 1: Clean previous build
echo -e "\n${BLUE}[1/4] Cleaning previous build...${NC}"
if [ -d "$PROJECT_ROOT/dist" ]; then
    rm -rf "$PROJECT_ROOT/dist"
    echo -e "${GREEN}✓ Cleaned dist directory${NC}"
fi

# Step 2: Build the Angular app
echo -e "\n${BLUE}[2/4] Building Angular app for stage: $DEPLOY_STAGE...${NC}"

# Check if Angular build configuration exists for the stage
BUILD_CONFIG="production"
if [ "$DEPLOY_STAGE" != "production" ]; then
    BUILD_CONFIG="$DEPLOY_STAGE"
fi

cd "$PROJECT_ROOT"
npm run build -- --configuration="$BUILD_CONFIG" 2>&1 | grep -E "(✓|✗|error|Error|ERROR|ng build)" || npm run build -- --configuration="$BUILD_CONFIG"

if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo -e "${RED}✗ Build failed: dist directory not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"

# Step 3: Sync to S3
echo -e "\n${BLUE}[3/4] Syncing to S3 bucket: $S3_BUCKET...${NC}"

# Find the built app directory (usually dist/<app-name>)
APP_DIST=$(find "$PROJECT_ROOT/dist" -maxdepth 1 -type d ! -name "dist" | head -1)/browser
if [ -z "$APP_DIST" ] || [ ! -d "$APP_DIST" ]; then
    # Fallback to dist if there's only one directory there
    if [ "$(ls -1 "$PROJECT_ROOT/dist" | wc -l)" -eq 1 ]; then
        APP_DIST="$PROJECT_ROOT/dist"
    else
        echo -e "${RED}✗ Could not find built app directory in dist${NC}"
        exit 1
    fi
fi

# Sync to S3 with appropriate flags
aws s3 sync "$APP_DIST" "s3://$S3_BUCKET" \
    --region "$AWS_REGION" \
    --delete \
    --cache-control "public, max-age=3600" \
    --exclude ".git*" \
    --exclude ".DS_Store"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ S3 sync failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Synced to S3${NC}"

# Step 4: Invalidate CloudFront distribution
echo -e "\n${BLUE}[4/4] Invalidating CloudFront distribution...${NC}"

aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --region "$AWS_REGION" > /dev/null

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ CloudFront invalidation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ CloudFront invalidation initiated${NC}"

# Success
echo -e "\n${GREEN}=== Deployment completed successfully! ===${NC}"
echo -e "${BLUE}Your app is being deployed to:${NC} ${YELLOW}https://$S3_BUCKET${NC}"
echo -e "${BLUE}CloudFront cache will be cleared shortly.${NC}"
