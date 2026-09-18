-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'RECOVERY_MANAGER', 'SUPPORT_AGENT', 'DEVELOPER', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('RAZORPAY', 'SHOPIFY', 'WHATSAPP', 'STRIPE');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIALIZED', 'FAILED', 'CAPTURED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DETECTED', 'DIAGNOSED', 'ELIGIBILITY_CHECKED', 'APPROVAL_REQUIRED', 'SCHEDULED', 'EXECUTING', 'OUTCOME_OBSERVED', 'RECOVERED', 'RETRY_SCHEDULED', 'STOPPED');

-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'BROKEN', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ABANDONED', 'CONTACTED', 'RECOVERED', 'EXPIRED', 'OUT_OF_STOCK_ABORTED', 'REQUIRES_APPROVAL');

-- CreateEnum
CREATE TYPE "AbandonmentType" AS ENUM ('CHECKOUT_STEP', 'PAYMENT_FAILED', 'CART_PAGE');

-- CreateEnum
CREATE TYPE "RecoveryStage" AS ENUM ('QUEUED', 'WHATSAPP_SENT', 'EMAIL_FALLBACK', 'CONCIERGE_ACTIVE', 'RECOVERED', 'EXPIRED', 'OUT_OF_STOCK_ABORTED', 'REQUIRES_APPROVAL');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "SuppressionType" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "OrderFinancialStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RESTOCKED');

-- CreateEnum
CREATE TYPE "FulfillmentTransitStatus" AS ENUM ('PENDING', 'INFO_RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'INSPECTED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('SIZE_TOO_SMALL', 'SIZE_TOO_LARGE', 'DEFECTIVE_ITEM', 'ITEM_NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activeMerchantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRevocation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    "reason" TEXT NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRevocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "mode" "IntegrationMode" NOT NULL DEFAULT 'SANDBOX',
    "keyId" TEXT,
    "encryptedSecret" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "storeUrl" TEXT NOT NULL,
    "shopDomain" TEXT,
    "storeName" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "shopifyScopes" TEXT[] DEFAULT ARRAY['read_checkouts', 'read_orders', 'write_discounts', 'read_products', 'read_inventory']::TEXT[],
    "encryptedShopifyAccessToken" TEXT,
    "encryptedWhatsappToken" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappTemplateName" TEXT DEFAULT 'recoverflow_cart_recovery',
    "encryptedResendApiKey" TEXT,
    "fromEmail" TEXT DEFAULT 'recovery@recoverflow.ai',
    "supportPhone" TEXT,
    "brandToneGuidelines" TEXT NOT NULL DEFAULT 'Helpful, conversational, and direct. Focus on product value.',
    "brandVoiceCasualVsFormal" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "brandVoiceUrgencyVsGentle" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "discountCeilingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "minMarginPercentage" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "brandProfile" JSONB,
    "customVoiceId" TEXT,
    "encryptedGeminiApiKey" TEXT,
    "dataTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "merchantId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "highValueThresholdPaise" BIGINT NOT NULL DEFAULT 1000000,
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
    "minEvThresholdPaise" BIGINT NOT NULL DEFAULT 0,
    "enabledChannels" TEXT[] DEFAULT ARRAY['WHATSAPP', 'EMAIL', 'UPI_INTENT']::TEXT[],
    "suppressedCategories" TEXT[] DEFAULT ARRAY['permanent_account_closure', 'customer_cancellation']::TEXT[],
    "autoExecuteBelowThreshold" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isOptedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" TIMESTAMP(3),
    "lifetimeValuePaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "externalPaymentId" TEXT NOT NULL,
    "orderReference" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'FAILED',
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFailure" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "failureCategory" TEXT NOT NULL,
    "rawErrorCode" TEXT,
    "rawErrorMessage" TEXT,
    "isRecoverable" BOOLEAN NOT NULL DEFAULT true,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'DETECTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "recoveryProbBps" INTEGER NOT NULL DEFAULT 0,
    "expectedValuePaise" BIGINT NOT NULL DEFAULT 0,
    "nextAttemptScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryDecision" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "policyId" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "probRecoveryBps" INTEGER NOT NULL,
    "expectedValuePaise" BIGINT NOT NULL,
    "featuresSnapshot" JSONB NOT NULL,
    "aiAdvisoryAnalysis" TEXT,
    "isHaltedBySafety" BOOLEAN NOT NULL DEFAULT false,
    "safetyHaltReason" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAttempt" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerResponse" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalMsgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryOutcome" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "isRecovered" BOOLEAN NOT NULL,
    "recoveredAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "feeAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "observedVia" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseToPay" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT,
    "customerId" TEXT NOT NULL,
    "promisedAmountPaise" BIGINT NOT NULL,
    "promisedDate" TIMESTAMP(3) NOT NULL,
    "status" "PromiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'CONCIERGE_CHAT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "amountPaise" BIGINT NOT NULL,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "source" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "eventType" TEXT NOT NULL,
    "providerEventId" TEXT,
    "externalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT,
    "rawPayload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMMITTED',
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "lockedUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "merchantId" TEXT,
    "userId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "correlationId" TEXT,
    "previousHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "brierScore" DOUBLE PRECISION NOT NULL,
    "expectedCalibError" DOUBLE PRECISION NOT NULL,
    "weightsJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrediction" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "inputFeatures" JSONB NOT NULL,
    "predictedProbBps" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartEvent" (
    "id" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ABANDONED',
    "abandonmentType" "AbandonmentType" NOT NULL DEFAULT 'CHECKOUT_STEP',
    "recoveryStage" "RecoveryStage" NOT NULL DEFAULT 'QUEUED',
    "checkoutUrl" TEXT NOT NULL,
    "suggestedDiscountCode" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "cartEventId" TEXT,
    "merchantId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionList" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "type" "SuppressionType" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'USER_UNSUBSCRIBE',
    "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "cartToken" TEXT,
    "merchantId" TEXT,
    "attackType" TEXT NOT NULL,
    "flaggedPatterns" TEXT[],
    "rawInput" TEXT NOT NULL,
    "normalizedInput" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "financialStatus" "OrderFinancialStatus" NOT NULL DEFAULT 'PAID',
    "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "shopifyFulfillmentId" TEXT NOT NULL,
    "trackingCompany" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "status" "FulfillmentTransitStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "estimatedDeliveryAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "latestLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "shopifyReturnId" TEXT,
    "reason" "ReturnReason" NOT NULL DEFAULT 'SIZE_TOO_SMALL',
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "refundAmount" DOUBLE PRECISION,
    "refundAmountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "returnTrackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,

    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentAssignment" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentExposure" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "exposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,

    CONSTRAINT "ExperimentExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentOutcome" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "isConverted" BOOLEAN NOT NULL DEFAULT false,
    "grossRecoveredPaise" BIGINT NOT NULL DEFAULT 0,
    "netMarginPaise" BIGINT NOT NULL DEFAULT 0,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_isRevoked_idx" ON "Session"("userId", "isRevoked");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "SessionRevocation_userId_idx" ON "SessionRevocation"("userId");

-- CreateIndex
CREATE INDEX "SessionRevocation_sessionId_idx" ON "SessionRevocation"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Integration_merchantId_type_idx" ON "Integration"("merchantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_merchantId_type_mode_key" ON "Integration"("merchantId", "type", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_storeUrl_key" ON "Merchant"("storeUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_shopDomain_key" ON "Merchant"("shopDomain");

-- CreateIndex
CREATE INDEX "Merchant_organizationId_idx" ON "Merchant"("organizationId");

-- CreateIndex
CREATE INDEX "RecoveryPolicy_merchantId_version_idx" ON "RecoveryPolicy"("merchantId", "version");

-- CreateIndex
CREATE INDEX "RecoveryPolicy_organizationId_idx" ON "RecoveryPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_merchantId_isOptedOut_idx" ON "Customer"("merchantId", "isOptedOut");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_merchantId_phone_key" ON "Customer"("merchantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_merchantId_email_key" ON "Customer"("merchantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalPaymentId_key" ON "Payment"("externalPaymentId");

-- CreateIndex
CREATE INDEX "Payment_merchantId_status_idx" ON "Payment"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Payment_merchantId_createdAt_idx" ON "Payment"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderReference_idx" ON "Payment"("orderReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFailure_paymentId_key" ON "PaymentFailure"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_paymentId_key" ON "RecoveryCase"("paymentId");

-- CreateIndex
CREATE INDEX "RecoveryCase_merchantId_status_idx" ON "RecoveryCase"("merchantId", "status");

-- CreateIndex
CREATE INDEX "RecoveryCase_merchantId_nextAttemptScheduledAt_idx" ON "RecoveryCase"("merchantId", "nextAttemptScheduledAt");

-- CreateIndex
CREATE INDEX "RecoveryCase_status_createdAt_idx" ON "RecoveryCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RecoveryDecision_recoveryCaseId_idx" ON "RecoveryDecision"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_recoveryCaseId_attemptNumber_idx" ON "RecoveryAttempt"("recoveryCaseId", "attemptNumber");

-- CreateIndex
CREATE INDEX "RecoveryOutcome_recoveryCaseId_idx" ON "RecoveryOutcome"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "PromiseToPay_customerId_status_idx" ON "PromiseToPay"("customerId", "status");

-- CreateIndex
CREATE INDEX "PromiseToPay_promisedDate_status_idx" ON "PromiseToPay"("promisedDate", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_recoveryCaseId_status_idx" ON "ApprovalRequest"("recoveryCaseId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_provider_idx" ON "WebhookEvent"("merchantId", "provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_merchantId_provider_providerEventId_key" ON "WebhookEvent"("merchantId", "provider", "providerEventId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_merchantId_expiresAt_idx" ON "IdempotencyKey"("merchantId", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_status_lockedUntil_idx" ON "IdempotencyKey"("status", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_merchantId_endpoint_key_key" ON "IdempotencyKey"("merchantId", "endpoint", "key");

-- CreateIndex
CREATE INDEX "AuditEvent_merchantId_createdAt_idx" ON "AuditEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_entityType_idx" ON "AuditEvent"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "ModelPrediction_modelVersionId_createdAt_idx" ON "ModelPrediction"("modelVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_merchantId_isRead_idx" ON "Notification"("merchantId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "CartEvent_cartToken_key" ON "CartEvent"("cartToken");

-- CreateIndex
CREATE INDEX "CartEvent_merchantId_status_idx" ON "CartEvent"("merchantId", "status");

-- CreateIndex
CREATE INDEX "CartEvent_merchantId_cartToken_idx" ON "CartEvent"("merchantId", "cartToken");

-- CreateIndex
CREATE INDEX "CartEvent_merchantId_createdAt_idx" ON "CartEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "CartEvent_customerPhone_idx" ON "CartEvent"("customerPhone");

-- CreateIndex
CREATE INDEX "CartEvent_customerEmail_idx" ON "CartEvent"("customerEmail");

-- CreateIndex
CREATE INDEX "MessageLog_cartEventId_idx" ON "MessageLog"("cartEventId");

-- CreateIndex
CREATE INDEX "MessageLog_merchantId_channel_idx" ON "MessageLog"("merchantId", "channel");

-- CreateIndex
CREATE INDEX "MessageLog_merchantId_createdAt_idx" ON "MessageLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "SuppressionList_identifier_idx" ON "SuppressionList"("identifier");

-- CreateIndex
CREATE INDEX "SuppressionList_merchantId_type_idx" ON "SuppressionList"("merchantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionList_merchantId_identifier_key" ON "SuppressionList"("merchantId", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_merchantId_status_idx" ON "OutboxEvent"("merchantId", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_lockedBy_lockedAt_idx" ON "OutboxEvent"("lockedBy", "lockedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_leaseExpiresAt_idx" ON "OutboxEvent"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "SecurityIncident_attackType_createdAt_idx" ON "SecurityIncident"("attackType", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityIncident_merchantId_createdAt_idx" ON "SecurityIncident"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "Order_merchantId_orderNumber_idx" ON "Order"("merchantId", "orderNumber");

-- CreateIndex
CREATE INDEX "Order_merchantId_customerPhone_idx" ON "Order"("merchantId", "customerPhone");

-- CreateIndex
CREATE INDEX "Order_merchantId_customerEmail_idx" ON "Order"("merchantId", "customerEmail");

-- CreateIndex
CREATE INDEX "Order_shopifyOrderId_idx" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfillment_shopifyFulfillmentId_key" ON "Fulfillment"("shopifyFulfillmentId");

-- CreateIndex
CREATE INDEX "Fulfillment_orderId_idx" ON "Fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "Fulfillment_merchantId_trackingNumber_idx" ON "Fulfillment"("merchantId", "trackingNumber");

-- CreateIndex
CREATE INDEX "Fulfillment_shopifyFulfillmentId_idx" ON "Fulfillment"("shopifyFulfillmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Return_shopifyReturnId_key" ON "Return"("shopifyReturnId");

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- CreateIndex
CREATE INDEX "Return_merchantId_status_idx" ON "Return"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Experiment_merchantId_status_idx" ON "Experiment"("merchantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentVariant_experimentId_key_key" ON "ExperimentVariant"("experimentId", "key");

-- CreateIndex
CREATE INDEX "ExperimentAssignment_merchantId_experimentId_idx" ON "ExperimentAssignment"("merchantId", "experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentAssignment_experimentId_subjectKey_key" ON "ExperimentAssignment"("experimentId", "subjectKey");

-- CreateIndex
CREATE INDEX "ExperimentExposure_experimentId_variantId_idx" ON "ExperimentExposure"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "ExperimentExposure_merchantId_exposedAt_idx" ON "ExperimentExposure"("merchantId", "exposedAt");

-- CreateIndex
CREATE INDEX "ExperimentOutcome_experimentId_variantId_idx" ON "ExperimentOutcome"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "ExperimentOutcome_merchantId_observedAt_idx" ON "ExperimentOutcome"("merchantId", "observedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPolicy" ADD CONSTRAINT "RecoveryPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPolicy" ADD CONSTRAINT "RecoveryPolicy_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFailure" ADD CONSTRAINT "PaymentFailure_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryDecision" ADD CONSTRAINT "RecoveryDecision_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryDecision" ADD CONSTRAINT "RecoveryDecision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "RecoveryPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryOutcome" ADD CONSTRAINT "RecoveryOutcome_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPrediction" ADD CONSTRAINT "ModelPrediction_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartEvent" ADD CONSTRAINT "CartEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_cartEventId_fkey" FOREIGN KEY ("cartEventId") REFERENCES "CartEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressionList" ADD CONSTRAINT "SuppressionList_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentExposure" ADD CONSTRAINT "ExperimentExposure_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentExposure" ADD CONSTRAINT "ExperimentExposure_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentOutcome" ADD CONSTRAINT "ExperimentOutcome_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentOutcome" ADD CONSTRAINT "ExperimentOutcome_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

