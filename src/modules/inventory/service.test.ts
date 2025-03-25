// service.test.ts
import { InventoryService } from "./service"
import { InventoryRepository } from "./repository"
import { DtoOrderItemStatus, DtoOrder } from "../order/types"
import kafka from "../../config/kafka"

jest.mock("./repository")
jest.mock("../../config/kafka")

describe("InventoryService", () => {
  const mockProducer = { send: jest.fn().mockResolvedValue(true) }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(kafka.producer as jest.Mock).mockReturnValue(mockProducer)
  })

  describe("onOrderPlaced", () => {
    it("should reduce inventory and publish StockReserved when all items are fulfilled", async () => {
      const mockOrder: DtoOrder = {
        id: "ORDER_123",
        items: [
          { productId: "PRODUCT_1", quantity: 2 },
          { productId: "PRODUCT_2", quantity: 3 },
        ],
      }

      const mockInventories = [
        { id: "INV_1", productId: "PRODUCT_1", quantity: 5 },
        { id: "INV_2", productId: "PRODUCT_2", quantity: 4 },
      ]
      ;(
        InventoryRepository.getInventoryByProductIds as jest.Mock
      ).mockResolvedValue(mockInventories)

      await InventoryService.onOrderPlaced(mockOrder)

      expect(InventoryRepository.getInventoryByProductIds).toHaveBeenCalledWith(
        ["PRODUCT_1", "PRODUCT_2"]
      )

      expect(
        InventoryRepository.reduceInventoryByProductId
      ).toHaveBeenCalledTimes(2)

      expect(mockProducer.send).toHaveBeenCalledTimes(1)
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: "StockReserved",
        messages: [
          {
            key: "ORDER_123",
            value: JSON.stringify({
              id: "ORDER_123",
              items: [
                {
                  productId: "PRODUCT_1",
                  quantity: 2,
                  status: DtoOrderItemStatus.FULFILLED,
                },
                {
                  productId: "PRODUCT_2",
                  quantity: 3,
                  status: DtoOrderItemStatus.FULFILLED,
                },
              ],
            }),
          },
        ],
      })
    })

    it("should publish OutOfStock when all items are unfulfilled", async () => {
      const mockOrder: DtoOrder = {
        id: "ORDER_123",
        items: [
          { productId: "PRODUCT_1", quantity: 5 },
          { productId: "PRODUCT_2", quantity: 4 },
        ],
      }

      const mockInventories = [
        { id: "INV_1", productId: "PRODUCT_1", quantity: 3 }, // Insufficient
        { id: "INV_2", productId: "PRODUCT_2", quantity: 2 }, // Insufficient
      ]
      ;(
        InventoryRepository.getInventoryByProductIds as jest.Mock
      ).mockResolvedValue(mockInventories)

      await InventoryService.onOrderPlaced(mockOrder)

      expect(
        InventoryRepository.reduceInventoryByProductId
      ).not.toHaveBeenCalled()

      expect(mockProducer.send).toHaveBeenCalledTimes(2)

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: "OutOfStock",
        messages: [
          {
            key: "ORDER_123",
            value: JSON.stringify({
              id: "ORDER_123",
              items: [
                {
                  productId: "PRODUCT_1",
                  quantity: 5,
                  status: DtoOrderItemStatus.UNFULFILLED,
                },
                {
                  productId: "PRODUCT_2",
                  quantity: 4,
                  status: DtoOrderItemStatus.UNFULFILLED,
                },
              ],
            }),
          },
        ],
      })
    })

    it("should handle partial fulfillment", async () => {
      const mockOrder: DtoOrder = {
        id: "ORDER_123",
        items: [
          { productId: "PRODUCT_1", quantity: 2 }, // Fulfilled
          { productId: "PRODUCT_2", quantity: 5 }, // Unfulfilled
          { productId: "PRODUCT_3", quantity: 1 }, // Unfulfilled
          { productId: "PRODUCT_4", quantity: 3 }, // Fulfilled
        ],
      }

      const mockInventories = [
        { id: "INV_1", productId: "PRODUCT_1", quantity: 3 },
        { id: "INV_2", productId: "PRODUCT_2", quantity: 4 },
        { id: "INV_3", productId: "PRODUCT_3", quantity: 0 },
        { id: "INV_4", productId: "PRODUCT_4", quantity: 5 },
      ]
      ;(
        InventoryRepository.getInventoryByProductIds as jest.Mock
      ).mockResolvedValue(mockInventories)

      await InventoryService.onOrderPlaced(mockOrder)

      expect(
        InventoryRepository.reduceInventoryByProductId
      ).toHaveBeenCalledTimes(2)

      expect(
        InventoryRepository.reduceInventoryByProductId
      ).toHaveBeenCalledWith("PRODUCT_1", 2)

      expect(
        InventoryRepository.reduceInventoryByProductId
      ).toHaveBeenCalledWith("PRODUCT_4", 3)

      expect(mockProducer.send).toHaveBeenCalledTimes(2)

      expect(mockProducer.send).toHaveBeenNthCalledWith(1, {
        topic: "StockReserved",
        messages: [
          {
            key: "ORDER_123",
            value: JSON.stringify({
              id: "ORDER_123",
              items: [
                {
                  productId: "PRODUCT_1",
                  quantity: 2,
                  status: DtoOrderItemStatus.FULFILLED,
                },
                {
                  productId: "PRODUCT_4",
                  quantity: 3,
                  status: DtoOrderItemStatus.FULFILLED,
                },
              ],
            }),
          },
        ],
      })

      expect(mockProducer.send).toHaveBeenNthCalledWith(2, {
        topic: "OutOfStock",
        messages: [
          {
            key: "ORDER_123",
            value: JSON.stringify({
              id: "ORDER_123",
              items: [
                {
                  productId: "PRODUCT_2",
                  quantity: 5,
                  status: DtoOrderItemStatus.UNFULFILLED,
                },
                {
                  productId: "PRODUCT_3",
                  quantity: 1,
                  status: DtoOrderItemStatus.UNFULFILLED,
                },
              ],
            }),
          },
        ],
      })
    })
  })
})
