-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive', 'discontinued');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('initial', 'purchase', 'sale', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'production_in', 'production_out', 'transfer_in', 'transfer_out', 'correction');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "stock" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(15,4),
    "costPrice" DECIMAL(15,2),
    "salePrice" DECIMAL(15,2),
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "previousStock" DECIMAL(15,4) NOT NULL,
    "currentStock" DECIMAL(15,4) NOT NULL,
    "unitCost" DECIMAL(15,2),
    "totalCost" DECIMAL(15,2),
    "reason" TEXT,
    "reference" TEXT,
    "quoteId" TEXT,
    "projectId" TEXT,
    "clientId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCategory_orgId_idx" ON "ProductCategory"("orgId");

-- CreateIndex
CREATE INDEX "ProductCategory_orgId_parentId_idx" ON "ProductCategory"("orgId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_orgId_name_key" ON "ProductCategory"("orgId", "name");

-- CreateIndex
CREATE INDEX "Product_orgId_idx" ON "Product"("orgId");

-- CreateIndex
CREATE INDEX "Product_orgId_status_idx" ON "Product"("orgId", "status");

-- CreateIndex
CREATE INDEX "Product_orgId_categoryId_idx" ON "Product"("orgId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_orgId_stock_idx" ON "Product"("orgId", "stock");

-- CreateIndex
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");

-- CreateIndex
CREATE INDEX "StockMovement_orgId_createdAt_idx" ON "StockMovement"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StockMovement_orgId_productId_createdAt_idx" ON "StockMovement"("orgId", "productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StockMovement_orgId_type_idx" ON "StockMovement"("orgId", "type");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
