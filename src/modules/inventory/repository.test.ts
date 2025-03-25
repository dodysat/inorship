import { InventoryRepository } from "./repository"
import prismaClient from "../../config/database"
import { Inventory } from "@prisma/client"

jest.mock("../../config/database", () => ({
  __esModule: true,
  default: {
    inventory: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe("InventoryRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getInventoryByProductIds", () => {
    it("should fetch inventory by productIds", async () => {
      const mockInventory: Inventory[] = [
        {
          id: "INVENTORY_123",
          productId: "PRODUCT_456",
          quantity: 10,
        },
        {
          id: "INVENTORY_456",
          productId: "PRODUCT_789",
          quantity: 5,
        },
      ]

      ;(prismaClient.inventory.findMany as jest.Mock).mockResolvedValue(
        mockInventory
      )

      const productIds = ["PRODUCT_456", "PRODUCT_789"]
      const result = await InventoryRepository.getInventoryByProductIds(
        productIds
      )

      expect(prismaClient.inventory.findMany).toHaveBeenCalledWith({
        where: {
          productId: {
            in: productIds,
          },
        },
      })
      expect(result).toEqual(mockInventory)
    })
  })

  describe("updateInventoryByProductId", () => {
    it("should update inventory by productId", async () => {
      const mockInventory: Inventory = {
        id: "INVENTORY_123",
        productId: "PRODUCT_456",
        quantity: 10,
      }

      ;(prismaClient.inventory.update as jest.Mock).mockResolvedValue(
        mockInventory
      )

      const productId = "PRODUCT_456"
      const quantity = 5
      const result = await InventoryRepository.reduceInventoryByProductId(
        productId,
        quantity
      )

      expect(prismaClient.inventory.update).toHaveBeenCalledWith({
        where: {
          id: productId,
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      })
      expect(result).toEqual(mockInventory)
    })
  })
})
