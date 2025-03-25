import { ShippingRepository } from "./repository"
import prismaClient from "../../config/database"
import { ShippingStatus } from "@prisma/client"

jest.mock("../../config/database", () => ({
  __esModule: true,
  default: {
    shipping: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    shippingItem: {
      createMany: jest.fn(),
    },
  },
}))

describe("ShippingRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createShipping", () => {
    it("should create a shipping using Prisma and return the result", async () => {
      const mockShipping = {
        id: "SHIPPING_123",
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      }

      // Mock the Prisma shipping.create method
      ;(prismaClient.shipping.create as jest.Mock).mockResolvedValue(
        mockShipping
      )

      const shippingData = {
        id: "SHIPPING_123",
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      }
      const result = await ShippingRepository.createShipping(shippingData)

      expect(prismaClient.shipping.create).toHaveBeenCalledWith({
        data: shippingData,
      })
      expect(result).toEqual(mockShipping)
    })
  })

  describe("createShippingItems", () => {
    it("should create shipping items using Prisma", async () => {
      const mockShippingItems: {
        id: string
        shippingId: string
        productId: string
        quantity: number
      }[] = [
        {
          id: "SHIPPING_ITEM_123",
          shippingId: "SHIPPING_123",
          productId: "PRODUCT_456",
          quantity: 2,
        },
        {
          id: "SHIPPING_ITEM_456",
          shippingId: "SHIPPING_123",
          productId: "PRODUCT_789",
          quantity: 3,
        },
      ]

      ;(prismaClient.shippingItem.createMany as jest.Mock).mockResolvedValue(
        null
      )

      await ShippingRepository.createShippingItems(mockShippingItems)

      expect(prismaClient.shippingItem.createMany).toHaveBeenCalledWith({
        data: mockShippingItems,
      })
    })
  })

  describe("updateShippingStatus", () => {
    it("should update shipping status using Prisma", async () => {
      const shippingId = "SHIPPING_123"
      const status = ShippingStatus.SHIPPED

      await ShippingRepository.updateShippingStatus(shippingId, status)

      expect(prismaClient.shipping.update).toHaveBeenCalledWith({
        where: { id: shippingId },
        data: { status },
      })
    })
  })

  describe("getShippingById", () => {
    it("should fetch a shipping by id using Prisma", async () => {
      const shippingId = "SHIPPING_123"
      const mockShipping = {
        id: "SHIPPING_123",
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      }

      ;(prismaClient.shipping.findUnique as jest.Mock).mockResolvedValue(
        mockShipping
      )

      const result = await ShippingRepository.getShippingById(shippingId)

      expect(prismaClient.shipping.findUnique).toHaveBeenCalledWith({
        where: { id: shippingId },
      })
      expect(result).toEqual(mockShipping)
    })
  })
})
