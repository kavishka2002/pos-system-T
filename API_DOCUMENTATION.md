# POS Backend API Documentation

## Overview
This document describes the REST API endpoints available in the Smart Retail POS system. All endpoints (except public reads) require Firebase authentication tokens.

## Authentication
Include the Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase_id_token>
```

To get the token from the client:
```typescript
const token = await user.getIdToken();
```

---

## Products API

### GET /api/products
**Public endpoint** - No authentication required

Retrieve all products.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_123",
      "name": "Product Name",
      "category": "Electronics",
      "costPrice": 100,
      "sellingPrice": 150,
      "specialPrice": 140,
      "profitPerItem": 50,
      "stockQuantity": 10,
      "barcode": "123456789",
      "imageUrl": "https://...",
      "createdAt": { "_seconds": 1704067200 },
      "updatedAt": { "_seconds": 1704067200 }
    }
  ]
}
```

### POST /api/products
**Requires authentication**

Create a new product with optional image upload.

**Request:**
- Content-Type: multipart/form-data
- Fields:
  - `name` (string, required)
  - `category` (string, required)
  - `costPrice` (number, required)
  - `sellingPrice` (number, required)
  - `specialPrice` (number, optional)
  - `stockQuantity` (number, required)
  - `barcode` (string, optional)
  - `image` (File, optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "imageUrl": "https://..."
  }
}
```

### GET /api/products/[id]
**Public endpoint** - No authentication required

Retrieve a specific product.

**Response:** Single product object (same structure as GET /api/products)

### PUT /api/products/[id]
**Requires authentication**

Update a product.

**Request:**
- Content-Type: application/json
- Body: Partial product fields to update

**Response:**
```json
{
  "success": true
}
```

### DELETE /api/products/[id]
**Requires authentication**

Delete a product.

**Response:**
```json
{
  "success": true
}
```

### POST /api/products/[id]/upload
**Requires authentication**

Upload or update a product image.

**Request:**
- Content-Type: multipart/form-data
- Fields:
  - `image` (File, required)

**Response:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://..."
  }
}
```

---

## Sales API

### GET /api/sales
**Public endpoint** - No authentication required

Retrieve all sales.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sale_123",
      "invoiceNumber": "INV-001",
      "items": [
        {
          "productId": "prod_123",
          "productName": "Product",
          "quantity": 2,
          "unitPrice": 150,
          "costPrice": 100,
          "priceType": "regular",
          "lineTotal": 300,
          "lineProfit": 100
        }
      ],
      "subtotal": 300,
      "discountType": "percentage",
      "discountValue": 10,
      "discountAmount": 30,
      "grandTotal": 270,
      "amountReceived": 300,
      "balance": 30,
      "totalCost": 200,
      "totalProfit": 70,
      "createdAt": { "_seconds": 1704067200 },
      "createdBy": "user_123"
    }
  ]
}
```

### GET /api/sales/range
**Public endpoint** - No authentication required

Retrieve sales within a date range.

**Query Parameters:**
- `start` (ISO date string, required): e.g., "2024-01-01"
- `end` (ISO date string, required): e.g., "2024-01-31"

**Response:** Array of sales (same structure as GET /api/sales)

### POST /api/sales
**Requires authentication**

Complete a checkout and create a sale.

**Request:**
- Content-Type: application/json
- Body:
```json
{
  "items": [
    {
      "productId": "prod_123",
      "name": "Product",
      "quantity": 2,
      "unitPrice": 150,
      "costPrice": 100,
      "priceType": "regular",
      "lineTotal": 300,
      "lineProfit": 100
    }
  ],
  "subtotal": 300,
  "discount": {
    "type": "percentage",
    "value": 10
  },
  "discountAmount": 30,
  "grandTotal": 270,
  "amountReceived": 300,
  "balance": 30,
  "totalCost": 200,
  "totalProfit": 70
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "saleId": "sale_123",
    "invoiceNumber": "INV-001"
  }
}
```

---

## Stock API

### GET /api/stock
**Public endpoint** - No authentication required

Retrieve stock movements.

**Query Parameters:**
- `limit` (number, optional, default: 100): Maximum number of movements to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "movement_123",
      "productId": "prod_123",
      "productName": "Product",
      "type": "out",
      "quantityChange": -2,
      "previousStock": 10,
      "newStock": 8,
      "referenceId": "sale_123",
      "note": "Sold via POS",
      "createdAt": { "_seconds": 1704067200 },
      "createdBy": "user_123"
    }
  ]
}
```

### POST /api/stock
**Requires authentication**

Record a stock movement.

**Request:**
- Content-Type: application/json
- Body:
```json
{
  "productId": "prod_123",
  "productName": "Product",
  "type": "in|out|adjustment",
  "quantityChange": 5,
  "previousStock": 10,
  "newStock": 15,
  "referenceId": "purchase_123",
  "note": "New stock received"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Settings API

### GET /api/settings
**Public endpoint** - No authentication required

Retrieve shop settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shop",
    "shopName": "Smart Retail Shop",
    "address": "123 Main Street, Colombo",
    "contactNumber": "+94 11 234 5678",
    "receiptFooter": "Thank you for shopping!",
    "lowStockThreshold": 10,
    "invoiceCounter": 1
  }
}
```

### PUT /api/settings
**Requires authentication**

Update shop settings.

**Request:**
- Content-Type: application/json
- Body: Partial settings to update
```json
{
  "shopName": "New Shop Name",
  "contactNumber": "+94 11 999 9999"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Client-Side Usage

### Using the Hooks

```typescript
import { useProductAPI, useSalesAPI, useStockAPI, useSettingsAPI } from '@/lib/hooks';

// Products
const productAPI = useProductAPI();
await productAPI.createProduct({ name: "Product", ... });
const products = await productAPI.getProducts();
await productAPI.updateProduct(id, { name: "Updated" });
await productAPI.deleteProduct(id);

// Sales
const salesAPI = useSalesAPI();
const sales = await salesAPI.getSales();
const rangeSales = await salesAPI.getSalesInRange(startDate, endDate);
const { saleId, invoiceNumber } = await salesAPI.checkout(checkoutData);

// Stock
const stockAPI = useStockAPI();
const movements = await stockAPI.getStockMovements(100);
await stockAPI.recordStockMovement(movementData);

// Settings
const settingsAPI = useSettingsAPI();
const settings = await settingsAPI.getSettings();
await settingsAPI.updateSettings({ shopName: "New Name" });
```

---

## Error Handling

All endpoints return error responses with this structure:
```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (missing/invalid fields)
- `401`: Unauthorized (authentication required or token invalid)
- `404`: Not Found
- `500`: Server Error

---

## Security Notes

1. **Authentication Required**: All POST, PUT, DELETE operations require valid Firebase authentication
2. **Token Verification**: Server-side validation of Firebase ID tokens prevents unauthorized access
3. **User ID**: The authenticated user's ID is automatically included in audit trails (createdBy)
4. **Public Reads**: GET requests for products, sales, and stock are public (consider restricting in production)
5. **Image Upload**: File type validation ensures only images can be uploaded
