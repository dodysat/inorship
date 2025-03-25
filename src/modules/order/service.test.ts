import { OrderService } from "./service"
import kafka from "../../config/kafka"
import { OrderRepository } from "./repository"
import { DtoOrderItemStatus } from "./types"
import { uid } from "../../helpers/utils"

jest.mock("./repository")
jest.mock("../../config/kafka")
jest.mock("../../helpers/utils", () => ({
  uid: jest.fn(),
}))

describe("OrderService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createOrder", () => {
    it("should throw an error when no items are provided", async () => {
      await expect(OrderService.createOrder([])).rejects.toThrow(
        "Order must have at least one item"
      )
    })

    it("should create an order with items and publish an event", async () => {
      const mockOrderId = "ORDER_123"
      const mockItemId = "ITEM_456"
      const mockProductId = "PRODUCT_789"
      const mockQuantity = 2

      ;(uid as jest.Mock)
        .mockReturnValueOnce(mockOrderId)
        .mockReturnValueOnce(mockItemId)

      const mockOrder = { id: mockOrderId }
      ;(OrderRepository.createOrder as jest.Mock).mockResolvedValue(mockOrder)

      const mockOrderItem = {
        id: mockItemId,
        orderId: mockOrderId,
        productId: mockProductId,
        quantity: mockQuantity,
        status: DtoOrderItemStatus.UNFULFILLED,
      }
      ;(OrderRepository.createOrderItems as jest.Mock).mockResolvedValue([
        mockOrderItem,
      ])

      const kafkaProducerMock = { send: jest.fn().mockResolvedValue(null) }
      ;(kafka.producer as jest.Mock).mockReturnValue(kafkaProducerMock)

      const items = [{ productId: mockProductId, quantity: mockQuantity }]
      const result = await OrderService.createOrder(items)

      expect(OrderRepository.createOrder).toHaveBeenCalledWith({
        id: mockOrderId,
      })
      expect(OrderRepository.createOrderItems).toHaveBeenCalledWith([
        {
          id: mockItemId,
          orderId: mockOrderId,
          productId: mockProductId,
          quantity: mockQuantity,
          status: DtoOrderItemStatus.UNFULFILLED,
        },
      ])

      expect(kafka.producer).toHaveBeenCalled()
      expect(kafkaProducerMock.send).toHaveBeenCalledWith({
        topic: "OrderPlaced",
        messages: [
          {
            key: mockOrderId,
            value: JSON.stringify({
              id: mockOrderId,
              items: [
                {
                  productId: mockProductId,
                  quantity: mockQuantity,
                  status: DtoOrderItemStatus.UNFULFILLED,
                },
              ],
            }),
          },
        ],
      })

      expect(result).toEqual({
        id: mockOrderId,
        items: [
          {
            productId: mockProductId,
            quantity: mockQuantity,
            status: DtoOrderItemStatus.UNFULFILLED,
          },
        ],
      })
    })
  })

  describe("onStockReserved", () => {
    it("should update order item status and publish an event", async () => {
      const mockOrderId = "ORDER_123"
      const mockProductId = "PRODUCT_789"
      const mockQuantity = 2
      const mockItemId = "ITEM_456"

      const order = {
        id: mockOrderId,
        items: [{ productId: mockProductId, quantity: mockQuantity }],
      }

      const mockOrderItem = {
        id: mockItemId,
        orderId: mockOrderId,
        productId: mockProductId,
        quantity: mockQuantity,
        status: DtoOrderItemStatus.UNFULFILLED,
      }

      ;(
        OrderRepository.getOrderItemsByOrderIdAndProductIds as jest.Mock
      ).mockResolvedValue([mockOrderItem])

      const kafkaProducerMock = { send: jest.fn().mockResolvedValue(null) }
      ;(kafka.producer as jest.Mock).mockReturnValue(kafkaProducerMock)

      await OrderService.onStockReserved(order)

      expect(
        OrderRepository.getOrderItemsByOrderIdAndProductIds
      ).toHaveBeenCalledWith(mockOrderId, [mockProductId])

      expect(OrderRepository.updateOrderItemStatus).toHaveBeenCalledWith(
        mockOrderId,
        mockProductId,
        DtoOrderItemStatus.FULFILLED
      )

      expect(kafka.producer).toHaveBeenCalled()
      expect(kafkaProducerMock.send).toHaveBeenCalledWith({
        topic: "OrderReadyForShipping",
        messages: [
          {
            key: mockOrderId,
            value: JSON.stringify(order),
          },
        ],
      })
    })
  })
})
